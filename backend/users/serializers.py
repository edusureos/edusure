from rest_framework import serializers
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from django.contrib.auth.password_validation import validate_password
from .models import User, StudentProfile
from django.contrib.auth import get_user_model


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
        
        return data


class FirebaseLoginSerializer(serializers.Serializer):
    id_token = serializers.CharField(help_text="Firebase ID Token returned by Client SDK after SMS OTP verification")


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



class FirebaseLoginSerializer(serializers.Serializer):
    id_token = serializers.CharField(required=True, help_text="The ID token returned by Firebase Phone Auth")