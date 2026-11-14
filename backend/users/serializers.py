from rest_framework import serializers
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from django.contrib.auth.password_validation import validate_password
from django.contrib.auth import get_user_model
from .models import User, StudentProfile, TeacherProfile, Notice, Attendance


class CustomLoginSerializer(TokenObtainPairSerializer):
    def validate(self, attrs):
        # super().validate(attrs) handles the strict ID & Password check securely
        data = super().validate(attrs) 
        
        user = self.user
        
        # Safely fetch phone number from User or StudentProfile
        phone = getattr(user, 'phone_number', '')
        if not phone and hasattr(user, 'student_profile'):
            phone = getattr(user.student_profile, 'registered_phone', '')

        # Build the response payload for the frontend
        data['role'] = user.role
        data['requires_password_change'] = user.requires_password_change
        data['username'] = user.username
        data['phone_number'] = phone  # This fixes the "undefined" error!
        data['school_id'] = user.school_id

        return data


class FirebaseLoginSerializer(serializers.Serializer):
    id_token = serializers.CharField(help_text="Firebase ID Token returned by Client SDK after SMS OTP verification")

class FirebaseLoginSerializer(serializers.Serializer):
    id_token = serializers.CharField(required=True, help_text="The ID token returned by Firebase Phone Auth")

class FirstLoginPasswordChangeSerializer(serializers.Serializer):
    new_password = serializers.CharField(write_only=True)
    confirm_password = serializers.CharField(write_only=True)

    def validate(self, data):
        if data['new_password'] != data['confirm_password']:
            raise serializers.ValidationError({"password": "Passwords do not match."})
        
        validate_password(data['new_password'])
        return data


class StudentProfileSerializer(serializers.ModelSerializer):
    class Meta:
        model = StudentProfile
        fields = [
            'admission_number', 'first_name', 'last_name', 
            'class_grade', 'section', 'roll_number', 'dob', 
            'blood_group', 'father_name', 'registered_phone', 'address'
        ]


class UserSerializer(serializers.ModelSerializer):
    student_profile = StudentProfileSerializer(read_only=True)

    class Meta:
        model = User
        fields = [
            'id', 'username', 'first_name', 'last_name', 
            'phone_number', 'role', 'requires_password_change', 
            'school_id', 'student_profile'
        ]


class UserProfileSerializer(serializers.ModelSerializer):
    student_profile = StudentProfileSerializer(read_only=True)

    class Meta:
        model = User
        fields = [
            'id', 'username', 'phone_number', 'role', 
            'requires_password_change', 'school_id', 'student_profile'
        ]


class SendOTPSerializer(serializers.Serializer):
    identifier = serializers.CharField(help_text="User ID (e.g. 1010260001) or Phone Number")


class VerifyOTPAndResetPasswordSerializer(serializers.Serializer):
    phone_number = serializers.CharField()
    otp = serializers.CharField(max_length=6)
    new_password = serializers.CharField(write_only=True)


import datetime
import secrets
import string
from django.db import transaction
from django.db.models import Max
from .models import User, StudentProfile, TeacherProfile, Notice


def generate_next_erp_id(school_id: int, role_digit: str) -> str:
    """Generates [SCHOOL(3)][ROLE(1)][YEAR(2)][SERIAL(4)] e.g. 1010260001"""
    year_short = datetime.date.today().strftime('%y')
    prefix = f"{int(school_id):03d}{role_digit}{year_short}"

    last_user = (
        User.objects.filter(username__startswith=prefix)
        .aggregate(max_id=Max('username'))
        .get('max_id')
    )

    if last_user and len(last_user) == 10 and last_user[6:].isdigit():
        next_serial = int(last_user[6:]) + 1
    else:
        next_serial = 1

    return f"{prefix}{next_serial:04d}"


def generate_temp_password(length=8) -> str:
    chars = string.ascii_letters + string.digits
    return ''.join(secrets.choice(chars) for _ in range(length))


def get_unique_user_phone(phone: str):
    """Returns phone if not already taken on User model, else None (prevents sibling crash)."""
    cleaned = (phone or '').strip()
    if not cleaned:
        return None
    if User.objects.filter(phone_number=cleaned).exists():
        return None
    return cleaned


class AdminCreateStudentSerializer(serializers.ModelSerializer):
    generated_user_id = serializers.CharField(source='user.username', read_only=True)
    temporary_password = serializers.CharField(read_only=True)

    class Meta:
        model = StudentProfile
        fields = [
            'generated_user_id', 'temporary_password',
            'admission_number', 'first_name', 'last_name',
            'class_grade', 'section', 'roll_number', 'dob',
            'blood_group', 'father_name', 'registered_phone', 'address'
        ]

    @transaction.atomic
    def create(self, validated_data):
        request = self.context.get('request')
        school_id = getattr(request.user, 'school_id', None) or 101

        new_username = generate_next_erp_id(school_id, role_digit='0')
        temp_password = generate_temp_password()
        raw_phone = validated_data.get('registered_phone', '')

        user = User.objects.create_user(
            username=new_username,
            password=temp_password,
            first_name=validated_data.get('first_name', ''),
            last_name=validated_data.get('last_name', ''),
            phone_number=get_unique_user_phone(raw_phone),
            role=User.Role.STUDENT,
            school_id=school_id,
            requires_password_change=True,
        )

        profile = StudentProfile.objects.create(user=user, **validated_data)
        profile.temporary_password = temp_password
        return profile


class AdminStudentListSerializer(serializers.ModelSerializer):
    user_id = serializers.CharField(source='user.username', read_only=True)
    is_active = serializers.BooleanField(source='user.is_active', read_only=True)

    class Meta:
        model = StudentProfile
        fields = [
            'user_id', 'is_active', 'admission_number',
            'first_name', 'last_name', 'class_grade', 'section',
            'roll_number', 'dob', 'blood_group', 'father_name',
            'registered_phone', 'address'
        ]


class AdminTeacherSerializer(serializers.ModelSerializer):
    user_id = serializers.CharField(source='user.username', read_only=True)
    is_active = serializers.BooleanField(source='user.is_active', read_only=True)
    temporary_password = serializers.CharField(read_only=True)

    class Meta:
        model = TeacherProfile
        fields = [
            'user_id', 'is_active', 'temporary_password',
            'employee_id', 'first_name', 'last_name',
            'subject', 'qualification', 'class_teacher_of',
            'registered_phone', 'joining_date'
        ]

    @transaction.atomic
    def create(self, validated_data):
        request = self.context.get('request')
        school_id = getattr(request.user, 'school_id', None) or 101

        new_username = generate_next_erp_id(school_id, role_digit='1')
        temp_password = generate_temp_password()
        raw_phone = validated_data.get('registered_phone', '')

        user = User.objects.create_user(
            username=new_username,
            password=temp_password,
            first_name=validated_data.get('first_name', ''),
            last_name=validated_data.get('last_name', ''),
            phone_number=get_unique_user_phone(raw_phone),
            role=User.Role.TEACHER,
            school_id=school_id,
            requires_password_change=True,
        )

        profile = TeacherProfile.objects.create(user=user, **validated_data)
        profile.temporary_password = temp_password
        return profile


class NoticeSerializer(serializers.ModelSerializer):
    created_by = serializers.CharField(source='created_by.username', read_only=True)
    target_roles = serializers.ListField(
        child=serializers.ChoiceField(choices=Notice.TargetRole.choices),
        allow_empty=False,
    )
    target_classes = serializers.ListField(
        child=serializers.CharField(max_length=20),
        required=False,
        default=list,
    )

    class Meta:
        model = Notice
        fields = [
            'id', 'title', 'content',
            'target_roles', 'target_classes',
            'created_by', 'created_at',
        ]
        read_only_fields = ['id', 'created_by', 'created_at']

    def validate_target_roles(self, value):
        unique_roles = list(dict.fromkeys(value))
        if 'ALL' in unique_roles:
            return ['ALL']
        return unique_roles

    def validate_target_classes(self, value):
        cleaned = [str(c).strip() for c in value if str(c).strip()]
        return list(dict.fromkeys(cleaned))

    def validate(self, attrs):
        if attrs.get('target_roles') == ['TEACHER']:
            attrs['target_classes'] = []
        return attrs

class AttendanceItemSerializer(serializers.Serializer):
    student_id = serializers.CharField(help_text="10-digit Student User ID (e.g. 1010260001)")
    status = serializers.ChoiceField(choices=Attendance.Status.choices)
    remarks = serializers.CharField(required=False, allow_blank=True, default='')


class BulkMarkAttendanceSerializer(serializers.Serializer):
    date = serializers.DateField(default=datetime.date.today)
    records = AttendanceItemSerializer(many=True, allow_empty=False)


class StudentAttendanceRecordSerializer(serializers.ModelSerializer):
    marked_by = serializers.CharField(source='marked_by.username', read_only=True)

    class Meta:
        model = Attendance
        fields = ['date', 'status', 'remarks', 'marked_by']        