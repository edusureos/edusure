import calendar
import datetime
import io
import math
import os
import random
import re
import zipfile

from django.contrib.auth import get_user_model
from django.db import transaction
from django.db.models import Count, Q
from django.http import FileResponse, HttpResponse
from django.shortcuts import get_object_or_404
from drf_spectacular.utils import OpenApiParameter, extend_schema
from firebase_admin import auth as firebase_auth
from rest_framework import permissions, status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.views import TokenObtainPairView

from .export_utils import export_to_csv, export_to_excel, export_to_pdf
from .models import Attendance, Notice, OTPStore, StudentProfile, TeacherProfile, User
from .permissions import IsSchoolAdmin, IsTeacherOrSchoolAdmin
from .serializers import (
    AdminCreateStudentSerializer,
    AdminStudentListSerializer,
    AdminTeacherSerializer,
    BulkMarkAttendanceSerializer,
    CustomLoginSerializer,
    FirebaseLoginSerializer,
    FirstLoginPasswordChangeSerializer,
    NoticeSerializer,
    SendOTPSerializer,
    StudentAttendanceRecordSerializer,
    UserProfileSerializer,
    VerifyOTPAndResetPasswordSerializer,
)
from .signals import find_file_for_class, list_school_bulk_files


class CustomLoginView(TokenObtainPairView):
    serializer_class = CustomLoginSerializer


class FirstLoginPasswordChangeView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        serializer = FirstLoginPasswordChangeSerializer(data=request.data)
        if serializer.is_valid():
            user = request.user
            user.set_password(serializer.validated_data['new_password'])
            user.requires_password_change = False
            user.save()
            return Response(
                {"detail": "Password updated successfully. You can now access your dashboard."},
                status=status.HTTP_200_OK,
            )
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class SendOTPView(APIView):
    """Generates 4-digit OTP for Forgot Password"""

    @extend_schema(request=SendOTPSerializer)
    def post(self, request):
        serializer = SendOTPSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        identifier = serializer.validated_data['identifier']
        user = User.objects.filter(username=identifier).first() or User.objects.filter(phone_number=identifier).first()

        if not user or not user.phone_number:
            return Response({"detail": "User or registered phone number not found."}, status=status.HTTP_404_NOT_FOUND)

        otp_code = str(random.randint(1000, 9999))

        OTPStore.objects.filter(phone_number=user.phone_number).delete()
        OTPStore.objects.create(phone_number=user.phone_number, otp=otp_code)

        print(f"\n==========================================")
        print(f" [SMS MOCK] Sending OTP {otp_code} to {user.phone_number}")
        print(f"==========================================\n")

        return Response(
            {"detail": "OTP sent successfully via SMS.", "phone_number": user.phone_number},
            status=status.HTTP_200_OK,
        )


class VerifyOTPAndResetPasswordView(APIView):
    """Verifies OTP and updates user password"""

    @extend_schema(request=VerifyOTPAndResetPasswordSerializer)
    def post(self, request):
        serializer = VerifyOTPAndResetPasswordSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        phone_number = serializer.validated_data['phone_number']
        otp = serializer.validated_data['otp']
        new_password = serializer.validated_data['new_password']

        otp_obj = OTPStore.objects.filter(phone_number=phone_number, otp=otp).first()

        if not otp_obj:
            return Response({"detail": "Invalid or expired OTP."}, status=status.HTTP_400_BAD_REQUEST)

        user = User.objects.filter(phone_number=phone_number).first()
        if not user:
            return Response({"detail": "User not found."}, status=status.HTTP_404_NOT_FOUND)

        user.set_password(new_password)
        user.requires_password_change = False
        user.save()

        otp_obj.delete()

        return Response({"detail": "Password reset successfully. You can now log in."}, status=status.HTTP_200_OK)


class UserProfileView(APIView):
    permission_classes = [IsAuthenticated]

    @extend_schema(
        summary="Fetch logged-in user profile",
        responses={200: UserProfileSerializer},
    )
    def get(self, request):
        user = request.user
        sp = getattr(user, 'student_profile', None)

        if sp:
            full_name = f"{sp.first_name} {sp.last_name}".strip()
            class_display = f"{sp.class_grade} - {sp.section}" if (sp.class_grade and sp.section) else (sp.class_grade or "")
            dob_display = sp.dob.strftime("%d %b %Y") if sp.dob else ""
            father_name = sp.father_name or ""
            mobile = sp.registered_phone or user.phone_number or ""
        else:
            full_name = f"{user.first_name} {user.last_name}".strip()
            class_display = ""
            dob_display = ""
            father_name = ""
            mobile = user.phone_number or ""

        return Response(
            {
                "username": user.username,
                "role": user.role,
                "school_id": user.school_id,
                "studentName": full_name,
                "class": class_display,
                "dateOfBirth": dob_display,
                "fatherName": father_name,
                "mobileNumber": mobile,
            },
            status=status.HTTP_200_OK,
        )


class LogoutView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        try:
            refresh_token = request.data.get("refresh")
            token = RefreshToken(refresh_token)
            token.blacklist()
            return Response({"detail": "Successfully logged out."}, status=status.HTTP_200_OK)
        except Exception:
            return Response({"detail": "Invalid token or already blacklisted."}, status=status.HTTP_400_BAD_REQUEST)


class FirebaseLoginView(APIView):
    permission_classes = [permissions.AllowAny]

    @extend_schema(
        summary="Login using Firebase Phone Auth ID Token",
        request=FirebaseLoginSerializer,
        responses={200: "JWT Access & Refresh Tokens"},
    )
    def post(self, request):
        serializer = FirebaseLoginSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        id_token = serializer.validated_data['id_token']

        try:
            decoded_token = firebase_auth.verify_id_token(id_token)
            firebase_phone = decoded_token.get('phone_number')

            if not firebase_phone:
                return Response({"error": "No phone number found in token."}, status=status.HTTP_400_BAD_REQUEST)

            phone_clean = firebase_phone[-10:]
            user = get_user_model().objects.filter(phone_number__endswith=phone_clean).first()

            if not user:
                user = get_user_model().objects.filter(
                    student_profile__registered_phone__endswith=phone_clean
                ).first()

            if not user:
                return Response(
                    {"error": "User with this phone number not found in our ERP."},
                    status=status.HTTP_404_NOT_FOUND,
                )

            refresh = RefreshToken.for_user(user)

            return Response(
                {
                    'refresh': str(refresh),
                    'access': str(refresh.access_token),
                    'role': getattr(user, 'role', 'student'),
                    'username': user.username,
                },
                status=status.HTTP_200_OK,
            )

        except firebase_auth.InvalidIdTokenError:
            return Response({"error": "Invalid or expired Firebase token."}, status=status.HTTP_401_UNAUTHORIZED)
        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class AdminStudentListCreateView(APIView):
    permission_classes = [IsAuthenticated, IsSchoolAdmin]

    @extend_schema(
        summary="List & search students in Admin's school",
        responses={200: AdminStudentListSerializer(many=True)},
    )
    def get(self, request):
        school_id = request.user.school_id
        qs = StudentProfile.objects.select_related('user').filter(user__school_id=school_id)

        class_grade = request.query_params.get('class_grade')
        section = request.query_params.get('section')
        search = request.query_params.get('search')

        if class_grade:
            qs = qs.filter(class_grade=class_grade)
        if section:
            qs = qs.filter(section=section)
        if search:
            qs = qs.filter(
                Q(user__username__icontains=search)
                | Q(first_name__icontains=search)
                | Q(last_name__icontains=search)
                | Q(admission_number__icontains=search)
            )

        serializer = AdminStudentListSerializer(qs.order_by('class_grade', 'roll_number'), many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)

    @extend_schema(
        summary="Create a new student with auto-generated 10-digit ID",
        request=AdminCreateStudentSerializer,
        responses={201: AdminCreateStudentSerializer},
    )
    def post(self, request):
        serializer = AdminCreateStudentSerializer(data=request.data, context={'request': request})
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class AdminStudentDetailView(APIView):
    """Edit student profile or activate/deactivate account"""

    permission_classes = [IsAuthenticated, IsSchoolAdmin]

    @extend_schema(request=AdminStudentListSerializer, responses={200: AdminStudentListSerializer})
    def patch(self, request, username):
        student_user = get_object_or_404(
            User, username=username, school_id=request.user.school_id, role=User.Role.STUDENT
        )
        if 'is_active' in request.data:
            student_user.is_active = bool(request.data['is_active'])
            student_user.save(update_fields=['is_active'])

        profile = student_user.student_profile
        serializer = AdminStudentListSerializer(profile, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            user_fields = []
            if 'first_name' in request.data:
                student_user.first_name = profile.first_name
                user_fields.append('first_name')
            if 'last_name' in request.data:
                student_user.last_name = profile.last_name
                user_fields.append('last_name')
            if user_fields:
                student_user.save(update_fields=user_fields)
            return Response(serializer.data, status=status.HTTP_200_OK)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class AdminTeacherListCreateView(APIView):
    permission_classes = [IsAuthenticated, IsSchoolAdmin]

    @extend_schema(summary="List all teachers in Admin's school", responses={200: AdminTeacherSerializer(many=True)})
    def get(self, request):
        qs = TeacherProfile.objects.select_related('user').filter(user__school_id=request.user.school_id)
        serializer = AdminTeacherSerializer(qs.order_by('first_name'), many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)

    @extend_schema(
        summary="Onboard a new teacher with auto 10-digit ID",
        request=AdminTeacherSerializer,
        responses={201: AdminTeacherSerializer},
    )
    def post(self, request):
        serializer = AdminTeacherSerializer(data=request.data, context={'request': request})
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


def _normalize_class(val):
    if not val:
        return ''
    s = str(val).strip().lower()
    s = re.sub(r'^class\s+', '', s)
    s = re.sub(r'^(\d+)(st|nd|rd|th)$', r'\1', s)
    return s.strip()


class NoticeListCreateView(APIView):
    """GET: Students/Teachers/Admins view school notices | POST: Admin & Teacher create notice"""

    permission_classes = [IsAuthenticated]

    @extend_schema(summary="Fetch notices for logged-in user's school & role", responses={200: NoticeSerializer(many=True)})
    def get(self, request):
        user = request.user
        qs = Notice.objects.select_related('created_by').filter(school_id=user.school_id)

        if user.role in [User.Role.SCHOOL_ADMIN, User.Role.SUPER_ADMIN]:
            notices = qs
        else:
            student_class = ''
            if user.role == User.Role.STUDENT:
                sp = getattr(user, 'student_profile', None)
                student_class = _normalize_class(sp.class_grade) if sp else ''

            notices = []
            for notice in qs:
                roles = notice.target_roles or []
                classes = [_normalize_class(c) for c in (notice.target_classes or []) if c]

                if user.role == User.Role.TEACHER:
                    if 'ALL' in roles or 'TEACHER' in roles:
                        notices.append(notice)

                elif user.role == User.Role.STUDENT:
                    if 'ALL' in roles or 'STUDENT' in roles:
                        if not classes or (student_class and student_class in classes):
                            notices.append(notice)

        serializer = NoticeSerializer(notices, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)

    @extend_schema(
        summary="Publish a new notice (Admin & Teacher)",
        request=NoticeSerializer,
        responses={201: NoticeSerializer},
    )
    def post(self, request):
        allowed_roles = [User.Role.SCHOOL_ADMIN, User.Role.SUPER_ADMIN, User.Role.TEACHER]
        if request.user.role not in allowed_roles:
            return Response(
                {"detail": "Only School Admins and Teachers can publish notices."},
                status=status.HTTP_403_FORBIDDEN,
            )

        serializer = NoticeSerializer(data=request.data)
        if serializer.is_valid():
            serializer.save(school_id=request.user.school_id, created_by=request.user)
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class NoticeDetailView(APIView):
    """Retrieve, update (PUT/PATCH), or delete (DELETE) a notice."""

    permission_classes = [IsAuthenticated]

    def _get_notice_or_error(self, request, pk):
        user = request.user
        allowed_roles = [User.Role.SCHOOL_ADMIN, User.Role.SUPER_ADMIN, User.Role.TEACHER]

        if user.role not in allowed_roles:
            return None, Response(
                {"detail": "Only School Admins and Teachers can edit or delete notices."},
                status=status.HTTP_403_FORBIDDEN,
            )

        if user.role == User.Role.SUPER_ADMIN and not user.school_id:
            notice = get_object_or_404(Notice, pk=pk)
        else:
            notice = get_object_or_404(Notice, pk=pk, school_id=user.school_id)

        if user.role == User.Role.TEACHER and notice.created_by_id != user.id:
            return None, Response(
                {"detail": "You can only edit or delete notices you created."},
                status=status.HTTP_403_FORBIDDEN,
            )

        return notice, None

    @extend_schema(summary="Get notice details", responses={200: NoticeSerializer})
    def get(self, request, pk):
        notice, error_response = self._get_notice_or_error(request, pk)
        if error_response:
            return error_response
        return Response(NoticeSerializer(notice).data, status=status.HTTP_200_OK)

    @extend_schema(
        summary="Update a notice (Admin & Teacher)",
        request=NoticeSerializer,
        responses={200: NoticeSerializer},
    )
    def put(self, request, pk):
        notice, error_response = self._get_notice_or_error(request, pk)
        if error_response:
            return error_response

        serializer = NoticeSerializer(notice, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data, status=status.HTTP_200_OK)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    @extend_schema(
        summary="Partially update a notice (Admin & Teacher)",
        request=NoticeSerializer,
        responses={200: NoticeSerializer},
    )
    def patch(self, request, pk):
        return self.put(request, pk)

    @extend_schema(summary="Delete a notice (Admin & Teacher)")
    def delete(self, request, pk):
        notice, error_response = self._get_notice_or_error(request, pk)
        if error_response:
            return error_response

        notice.delete()
        return Response(
            {"detail": "Notice deleted successfully."},
            status=status.HTTP_200_OK,
        )


class ClassAttendanceView(APIView):
    """
    GET: Fetch class roll-call sheet with existing attendance status for a date
    POST: Mark or update bulk attendance for a class
    """

    permission_classes = [IsAuthenticated, IsTeacherOrSchoolAdmin]

    @extend_schema(summary="Get class student list with attendance status for a given date")
    def get(self, request):
        school_id = request.user.school_id
        class_grade = request.query_params.get('class_grade')
        section = request.query_params.get('section', '')
        date_str = request.query_params.get('date')

        if not class_grade:
            return Response({"detail": "class_grade query parameter is required."}, status=status.HTTP_400_BAD_REQUEST)

        try:
            target_date = datetime.date.fromisoformat(date_str) if date_str else datetime.date.today()
        except ValueError:
            return Response({"detail": "Invalid date format. Use YYYY-MM-DD."}, status=status.HTTP_400_BAD_REQUEST)

        teacher_scope = _teacher_attendance_scope(request.user)
        if teacher_scope is not None and (
            class_grade != teacher_scope[0]
            or (section and teacher_scope[1] and section != teacher_scope[1])
        ):
            return Response({"detail": "You are not assigned to this class."}, status=status.HTTP_403_FORBIDDEN)
        if teacher_scope is not None and teacher_scope[1]:
            section = teacher_scope[1]

        students_qs = StudentProfile.objects.select_related('user').filter(
            user__school_id=school_id,
            user__is_active=True,
            class_grade=class_grade,
        )
        if section:
            students_qs = students_qs.filter(section=section)

        students_qs = students_qs.order_by('roll_number', 'first_name')

        existing_records = {
            att.student_id: att
            for att in Attendance.objects.filter(
                school_id=school_id,
                date=target_date,
                student__in=[s.user_id for s in students_qs],
            )
        }

        roll_call = []
        for sp in students_qs:
            att = existing_records.get(sp.user_id)
            roll_call.append(
                {
                    "student_id": sp.user.username,
                    "roll_number": sp.roll_number,
                    "name": f"{sp.first_name} {sp.last_name}".strip(),
                    "class_grade": sp.class_grade,
                    "section": sp.section,
                    "status": att.status if att else "UNMARKED",
                    "remarks": att.remarks if att else "",
                }
            )

        return Response(
            {
                "date": str(target_date),
                "class_grade": class_grade,
                "section": section,
                "total_students": len(roll_call),
                "students": roll_call,
            },
            status=status.HTTP_200_OK,
        )

    @extend_schema(
        summary="Mark or update attendance in bulk for a date",
        request=BulkMarkAttendanceSerializer,
    )
    def post(self, request):
        serializer = BulkMarkAttendanceSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        school_id = request.user.school_id
        target_date = serializer.validated_data['date']
        records = serializer.validated_data['records']

        student_usernames = [item['student_id'] for item in records]
        teacher_scope = _teacher_attendance_scope(request.user)
        student_filters = {
            'username__in': student_usernames,
            'school_id': school_id,
            'role': User.Role.STUDENT,
        }
        if teacher_scope is not None:
            student_filters['student_profile__class_grade'] = teacher_scope[0]
            if teacher_scope[1] is not None:
                student_filters['student_profile__section'] = teacher_scope[1]
        valid_students = {
            u.username: u
            for u in User.objects.filter(**student_filters)
        }

        invalid_ids = [sid for sid in student_usernames if sid not in valid_students]
        if invalid_ids:
            return Response(
                {"detail": "One or more students are outside your school or assigned class."},
                status=status.HTTP_403_FORBIDDEN if teacher_scope is not None else status.HTTP_400_BAD_REQUEST,
            )

        with transaction.atomic():
            for item in records:
                Attendance.objects.update_or_create(
                    student=valid_students[item['student_id']],
                    date=target_date,
                    defaults={
                        'school_id': school_id,
                        'status': item['status'],
                        'remarks': item.get('remarks', ''),
                        'marked_by': request.user,
                    },
                )

        return Response(
            {
                "detail": f"Attendance saved for {len(records)} students.",
                "date": str(target_date),
            },
            status=status.HTTP_200_OK,
        )


def _teacher_attendance_scope(user):
    if user.role != User.Role.TEACHER:
        return None
    profile = TeacherProfile.objects.filter(user=user).only('class_teacher_of').first()
    assignment = (profile.class_teacher_of if profile else '').strip()
    if not assignment:
        return ('', None)
    if '-' in assignment:
        class_grade, section = assignment.rsplit('-', 1)
        return (class_grade.strip(), section.strip())
    return (assignment, None)


class AttendanceReportsView(APIView):
    permission_classes = [IsAuthenticated, IsTeacherOrSchoolAdmin]

    @extend_schema(summary="Get date-filtered attendance reports")
    def get(self, request):
        school_id = request.user.school_id
        if school_id is None:
            return Response(
                {"detail": "Your account is not associated with a school."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        today = datetime.date.today()
        start_date_value = request.query_params.get('start_date') or today.replace(day=1).isoformat()
        end_date_value = request.query_params.get('end_date') or today.isoformat()
        if (
            not re.fullmatch(r'\d{4}-\d{2}-\d{2}', start_date_value)
            or not re.fullmatch(r'\d{4}-\d{2}-\d{2}', end_date_value)
        ):
            return Response({"detail": "Dates must use YYYY-MM-DD format."}, status=status.HTTP_400_BAD_REQUEST)
        try:
            start_date = datetime.date.fromisoformat(start_date_value)
            end_date = datetime.date.fromisoformat(end_date_value)
        except ValueError:
            return Response({"detail": "Dates must use YYYY-MM-DD format."}, status=status.HTTP_400_BAD_REQUEST)
        if start_date > end_date:
            return Response({"detail": "Start date must not be after end date."}, status=status.HTTP_400_BAD_REQUEST)

        report_type = request.query_params.get('report_type', 'summary')
        if report_type not in {'student', 'class', 'summary'}:
            return Response({"detail": "report_type must be student, class, or summary."}, status=status.HTTP_400_BAD_REQUEST)

        operator = request.query_params.get('comparison', '').strip()
        threshold = None
        if operator:
            if operator not in {'lt', 'gt'}:
                return Response({"detail": "comparison must be lt or gt."}, status=status.HTTP_400_BAD_REQUEST)
            try:
                threshold = float(request.query_params.get('percentage', ''))
            except (TypeError, ValueError):
                return Response({"detail": "percentage must be a number from 0 to 100."}, status=status.HTTP_400_BAD_REQUEST)
            if not math.isfinite(threshold) or not 0 <= threshold <= 100:
                return Response({"detail": "percentage must be a number from 0 to 100."}, status=status.HTTP_400_BAD_REQUEST)
        elif request.query_params.get('percentage'):
            return Response({"detail": "Choose a comparison before entering a percentage."}, status=status.HTTP_400_BAD_REQUEST)

        teacher_scope = _teacher_attendance_scope(request.user)
        profiles = StudentProfile.objects.filter(
            user__school_id=school_id,
            user__role=User.Role.STUDENT,
            user__is_active=True,
        )
        if teacher_scope is not None:
            profiles = profiles.filter(class_grade=teacher_scope[0])
            if teacher_scope[1] is not None:
                profiles = profiles.filter(section=teacher_scope[1])

        class_options = {}
        for class_grade, section in profiles.values_list('class_grade', 'section').distinct().order_by('class_grade', 'section'):
            if not class_grade:
                continue
            class_options.setdefault(class_grade, set())
            if section:
                class_options[class_grade].add(section)

        class_grade = request.query_params.get('class_grade', '').strip()
        section = request.query_params.get('section', '').strip()
        if class_grade and class_grade not in class_options:
            return Response({"detail": "The selected class is not available to your account."}, status=status.HTTP_400_BAD_REQUEST)
        if section and (not class_grade or section not in class_options.get(class_grade, set())):
            return Response({"detail": "The selected section is not available for this class."}, status=status.HTTP_400_BAD_REQUEST)
        if class_grade:
            profiles = profiles.filter(class_grade=class_grade)
        if section:
            profiles = profiles.filter(section=section)

        search = request.query_params.get('search', '').strip()
        if search:
            profiles = profiles.filter(
                Q(user__username__icontains=search)
                | Q(first_name__icontains=search)
                | Q(last_name__icontains=search)
            )

        profile_rows = list(profiles.select_related('user').order_by('class_grade', 'section', 'roll_number', 'first_name'))
        profile_by_id = {profile.user_id: profile for profile in profile_rows}
        attendance_by_student = {user_id: [] for user_id in profile_by_id}
        records = Attendance.objects.filter(
            school_id=school_id,
            student_id__in=profile_by_id,
            date__gte=start_date,
            date__lte=end_date,
        ).order_by('date', 'student__username')
        for record in records:
            attendance_by_student[record.student_id].append(record)

        students = []
        for profile in profile_rows:
            student_records = attendance_by_student[profile.user_id]
            present = sum(record.status in (Attendance.Status.PRESENT, Attendance.Status.LATE) for record in student_records)
            absent = sum(record.status == Attendance.Status.ABSENT for record in student_records)
            medical = sum(record.status == Attendance.Status.MEDICAL for record in student_records)
            total_days = len(student_records)
            exact_percentage = (present / total_days) * 100 if total_days else None
            percentage = round(exact_percentage, 1) if exact_percentage is not None else None
            if threshold is not None and (
                exact_percentage is None
                or (operator == 'lt' and exact_percentage >= threshold)
                or (operator == 'gt' and exact_percentage <= threshold)
            ):
                continue
            students.append({
                'student_id': profile.user.username,
                'name': f'{profile.first_name} {profile.last_name}'.strip() or profile.user.username,
                'roll_number': profile.roll_number,
                'class_grade': profile.class_grade,
                'section': profile.section,
                'total_days': total_days,
                'present_days': present,
                'absent_days': absent,
                'medical_days': medical,
                'attendance_percentage': percentage,
            })

        class_totals = {}
        for student in students:
            key = (student['class_grade'], student['section'])
            group = class_totals.setdefault(key, {
                'class_grade': key[0],
                'section': key[1],
                'total_students': 0,
                'total_days': 0,
                'present': 0,
                'absent': 0,
                'medical': 0,
            })
            group['total_students'] += 1
            group['total_days'] += student['total_days']
            group['present'] += student['present_days']
            group['absent'] += student['absent_days']
            group['medical'] += student['medical_days']
        class_wise = list(class_totals.values())
        for group in class_wise:
            group['attendance_percentage'] = (
                round((group['present'] / group['total_days']) * 100, 1) if group['total_days'] else None
            )

        total_days = sum(student['total_days'] for student in students)
        total_present = sum(student['present_days'] for student in students)
        selected_student_id = request.query_params.get('student_id', '').strip()
        selected_student = next(
            (student for student in students if student['student_id'] == selected_student_id),
            None,
        )
        if selected_student_id and selected_student is None:
            return Response({"detail": "The selected student is not available in this report."}, status=status.HTTP_400_BAD_REQUEST)
        student_records = []
        if selected_student:
            student_profile = next(profile for profile in profile_rows if profile.user.username == selected_student_id)
            student_records = [
                {'date': record.date.isoformat(), 'status': record.status, 'remarks': record.remarks}
                for record in reversed(attendance_by_student[student_profile.user_id])
            ]

        return Response({
            'report_type': report_type,
            'filters': {
                'start_date': start_date.isoformat(),
                'end_date': end_date.isoformat(),
                'class_grade': class_grade,
                'section': section,
            },
            'class_options': [
                {'class_grade': grade, 'sections': sorted(sections)}
                for grade, sections in sorted(class_options.items())
            ],
            'summary': {
                'total_students': len(students),
                'total_days': total_days,
                'present': total_present,
                'absent': sum(student['absent_days'] for student in students),
                'medical': sum(student['medical_days'] for student in students),
                'attendance_percentage': round((total_present / total_days) * 100, 1) if total_days else None,
            },
            'students': students,
            'class_wise': class_wise,
            'selected_student': selected_student,
            'student_records': student_records,
        }, status=status.HTTP_200_OK)


class StudentAttendanceSummaryView(APIView):
    """Fetch attendance percentage and daily history for a student"""

    permission_classes = [IsAuthenticated]

    @extend_schema(summary="Get student attendance summary & history")
    def get(self, request):
        user = request.user

        if user.role in [User.Role.TEACHER, User.Role.SCHOOL_ADMIN, User.Role.SUPER_ADMIN]:
            student_id = request.query_params.get('student_id')
            if not student_id:
                return Response({"detail": "student_id query param is required."}, status=status.HTTP_400_BAD_REQUEST)
            target_query = User.objects.filter(
                username=student_id,
                school_id=user.school_id,
                role=User.Role.STUDENT,
            )
            teacher_scope = _teacher_attendance_scope(user)
            if teacher_scope is not None:
                target_query = target_query.filter(student_profile__class_grade=teacher_scope[0])
                if teacher_scope[1] is not None:
                    target_query = target_query.filter(student_profile__section=teacher_scope[1])
            target_user = get_object_or_404(target_query)
        else:
            target_user = user

        qs = Attendance.objects.select_related('marked_by').filter(student=target_user)

        month = request.query_params.get('month')
        year = request.query_params.get('year')
        if month and year:
            qs = qs.filter(date__month=month, date__year=year)

        total_days = qs.count()
        present_days = qs.filter(status=Attendance.Status.PRESENT).count()
        late_days = qs.filter(status=Attendance.Status.LATE).count()
        absent_days = qs.filter(status=Attendance.Status.ABSENT).count()
        medical_days = qs.filter(status=Attendance.Status.MEDICAL).count()

        effective_present = present_days + late_days
        percentage = round((effective_present / total_days) * 100, 1) if total_days > 0 else 0.0

        serializer = StudentAttendanceRecordSerializer(qs[:60], many=True)
        return Response(
            {
                "student_id": target_user.username,
                "total_days": total_days,
                "present_days": present_days,
                "late_days": late_days,
                "absent_days": absent_days,
                "medical_days": medical_days,
                "attendance_percentage": percentage,
                "records": serializer.data,
            },
            status=status.HTTP_200_OK,
        )


class AdminDashboardStatsView(APIView):
    permission_classes = [IsAuthenticated, IsSchoolAdmin]

    @extend_schema(summary="Get Admin Dashboard summary counts including today's attendance")
    def get(self, request):
        school_id = request.user.school_id
        today = datetime.date.today()

        students_qs = StudentProfile.objects.filter(user__school_id=school_id, user__is_active=True)
        teachers_qs = User.objects.filter(school_id=school_id, role='TEACHER', is_active=True)

        class_breakdown = (
            StudentProfile.objects.filter(user__school_id=school_id, user__is_active=True)
            .values('class_grade', 'section')
            .annotate(count=Count('id'))
            .order_by('class_grade', 'section')
        )

        today_att_qs = Attendance.objects.filter(school_id=school_id, date=today)
        marked_today = today_att_qs.count()
        present_today = today_att_qs.filter(
            status__in=[Attendance.Status.PRESENT, Attendance.Status.LATE]
        ).count()
        absent_today = today_att_qs.filter(status=Attendance.Status.ABSENT).count()
        today_percentage = round((present_today / marked_today) * 100, 1) if marked_today > 0 else 0.0

        return Response(
            {
                "school_id": school_id,
                "total_students": students_qs.count(),
                "total_teachers": teachers_qs.count(),
                "class_breakdown": list(class_breakdown),
                "today_attendance": {
                    "date": str(today),
                    "total_marked": marked_today,
                    "present": present_today,
                    "absent": absent_today,
                    "percentage": today_percentage,
                },
            },
            status=status.HTTP_200_OK,
        )


def _get_contact(user, profile=None):
    for obj in (profile, user):
        if not obj:
            continue
        for field in ('registered_phone', 'phone_number', 'phone'):
            val = getattr(obj, field, None)
            if val:
                return val
    return ''


class AdminDatabaseExportView(APIView):
    """
    Export school database records (students, teachers, attendance)
    in csv, xlsx (Excel), or pdf format.
    """

    permission_classes = [IsAuthenticated, IsSchoolAdmin]

    @extend_schema(
        summary="Export school database records in CSV, Excel (.xlsx), or PDF",
        responses={200: bytes},
    )
    def get(self, request, entity, file_format):
        entity = entity.lower().strip()
        file_format = file_format.lower().strip()
        school_id = request.user.school_id
        today_str = datetime.date.today().isoformat()

        if file_format not in ('csv', 'xlsx', 'pdf'):
            return Response(
                {"detail": "Invalid format. Use 'csv', 'xlsx', or 'pdf'."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if entity == 'students':
            class_grade = request.query_params.get('class_grade')
            section = request.query_params.get('section')
            requested_filename = request.query_params.get('filename')

            if file_format in ('xlsx', 'csv') and not section:
                synced_files = list_school_bulk_files(school_id)
                if synced_files:
                    target_file = None

                    if requested_filename:
                        safe_name = os.path.basename(requested_filename)
                        for f in synced_files:
                            if os.path.basename(f) == safe_name:
                                target_file = f
                                break
                    elif class_grade:
                        target_file, _ = find_file_for_class(synced_files, class_grade)
                    elif len(synced_files) == 1:
                        target_file = synced_files[0]

                    if target_file and os.path.exists(target_file):
                        mime = (
                            'text/csv; charset=utf-8'
                            if target_file.endswith('.csv')
                            else 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
                        )
                        with open(target_file, 'rb') as fp:
                            file_bytes = io.BytesIO(fp.read())
                        return FileResponse(
                            file_bytes,
                            as_attachment=True,
                            filename=os.path.basename(target_file),
                            content_type=mime,
                        )

                    if len(synced_files) > 1 and not class_grade:
                        zip_buffer = io.BytesIO()
                        with zipfile.ZipFile(zip_buffer, 'w', zipfile.ZIP_DEFLATED) as zf:
                            for f in synced_files:
                                zf.write(f, arcname=os.path.basename(f))
                        zip_buffer.seek(0)
                        response = HttpResponse(zip_buffer.getvalue(), content_type='application/zip')
                        response['Content-Disposition'] = (
                            f'attachment; filename="edusure_students_{school_id}_{today_str}.zip"'
                        )
                        return response

            qs = StudentProfile.objects.select_related('user').filter(
                user__school_id=school_id
            ).order_by('class_grade', 'section', 'roll_number', 'first_name')

            if class_grade:
                qs = qs.filter(class_grade=class_grade)
            if section:
                qs = qs.filter(section=section)

            headers = [
                'Student ID', 'Full Name', 'Class', 'Section',
                'Roll No', 'Guardian Name', 'Contact', 'Status',
            ]
            rows = [
                [
                    sp.user.username,
                    f"{sp.first_name} {sp.last_name}".strip(),
                    sp.class_grade,
                    sp.section,
                    sp.roll_number,
                    sp.father_name,
                    _get_contact(sp.user, sp),
                    'Active' if sp.user.is_active else 'Inactive',
                ]
                for sp in qs
            ]
            title = f"EduSure School ({school_id}) - Student Directory"
            filename = f"edusure_students_{school_id}_{today_str}"

        elif entity == 'teachers':
            qs = TeacherProfile.objects.select_related('user').filter(
                user__school_id=school_id
            ).order_by('first_name')

            headers = [
                'Teacher ID', 'Employee ID', 'Full Name', 'Subject',
                'Qualification', 'Class Teacher Of', 'Contact', 'Joining Date', 'Status',
            ]
            rows = [
                [
                    tp.user.username,
                    tp.employee_id,
                    f"{tp.first_name} {tp.last_name}".strip(),
                    tp.subject,
                    tp.qualification,
                    tp.class_teacher_of,
                    _get_contact(tp.user, tp),
                    tp.joining_date.isoformat() if tp.joining_date else '',
                    'Active' if tp.user.is_active else 'Inactive',
                ]
                for tp in qs
            ]
            title = f"EduSure School ({school_id}) - Faculty Directory"
            filename = f"edusure_teachers_{school_id}_{today_str}"

        elif entity == 'attendance':
            qs = Attendance.objects.select_related(
                'student', 'student__student_profile', 'marked_by'
            ).filter(school_id=school_id).order_by('-date', 'student__username')

            date_str = request.query_params.get('date')
            class_grade = request.query_params.get('class_grade')
            section = request.query_params.get('section')
            if date_str:
                qs = qs.filter(date=date_str)
            if class_grade:
                qs = qs.filter(student__student_profile__class_grade=class_grade)
            if section:
                qs = qs.filter(student__student_profile__section=section)

            headers = [
                'Date', 'Student ID', 'Student Name', 'Class',
                'Section', 'Status', 'Remarks', 'Marked By',
            ]
            rows = []
            for att in qs:
                sp = getattr(att.student, 'student_profile', None)
                student_name = (
                    f"{sp.first_name} {sp.last_name}".strip()
                    if sp else att.student.username
                )
                rows.append(
                    [
                        str(att.date),
                        att.student.username,
                        student_name,
                        sp.class_grade if sp else '',
                        sp.section if sp else '',
                        att.status,
                        att.remarks,
                        att.marked_by.username if att.marked_by else '',
                    ]
                )
            title = f"EduSure School ({school_id}) - Attendance Report"
            filename = f"edusure_attendance_{school_id}_{today_str}"

        else:
            return Response(
                {"detail": "Invalid entity. Use 'students', 'teachers', or 'attendance'."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if file_format == 'csv':
            return export_to_csv(filename, headers, rows)
        if file_format == 'xlsx':
            return export_to_excel(filename, entity.capitalize(), headers, rows)
        return export_to_pdf(
            filename,
            title,
            f"Generated on {today_str} | Total Records: {len(rows)}",
            headers,
            rows,
        )


class AdminSyncedBulkFilesView(APIView):
    """List or download live-synced original Excel/CSV files for the school."""

    permission_classes = [IsAuthenticated, IsSchoolAdmin]

    @extend_schema(
        summary="List or download live-synced student Excel/CSV workbooks",
        parameters=[
            OpenApiParameter(
                name="download",
                type=str,
                location=OpenApiParameter.QUERY,
                required=False,
                description="Exact filename (e.g. Class_1_to_5.xlsx) to download directly",
            ),
        ],
        responses={200: dict},
    )
    def get(self, request):
        school_id = request.user.school_id
        download_name = request.query_params.get('download')
        files = list_school_bulk_files(school_id)

        if download_name:
            safe_name = os.path.basename(download_name)
            for f in files:
                if os.path.basename(f) == safe_name:
                    mime = (
                        'text/csv; charset=utf-8'
                        if f.endswith('.csv')
                        else 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
                    )
                    with open(f, 'rb') as fp:
                        file_bytes = io.BytesIO(fp.read())
                    return FileResponse(
                        file_bytes,
                        as_attachment=True,
                        filename=safe_name,
                        content_type=mime,
                    )
            return Response({"detail": "File not found."}, status=status.HTTP_404_NOT_FOUND)

        file_list = [
            {
                "filename": os.path.basename(f),
                "size_kb": round(os.path.getsize(f) / 1024, 1),
                "last_updated": datetime.datetime.fromtimestamp(os.path.getmtime(f)).isoformat(),
            }
            for f in files
        ]
        return Response({"school_id": school_id, "files": file_list}, status=status.HTTP_200_OK)


class AdminAttendanceOverviewView(APIView):
    """
    1. School-wide daily Present/Absent/Medical totals.
    2. Class-wise marking status (MARKED vs PENDING).
    3. Low-attendance defaulters list (below threshold %).
    """

    permission_classes = [IsAuthenticated, IsTeacherOrSchoolAdmin]

    @extend_schema(
        summary="School-wide daily attendance status & defaulter list",
        parameters=[
            OpenApiParameter(name="date", type=str, required=False, description="YYYY-MM-DD (default today)"),
            OpenApiParameter(name="threshold", type=int, required=False, description="Min attendance % (default 75)"),
        ],
    )
    def get(self, request):
        date_str = (request.query_params.get("date") or "").strip()

        try:
            target_date = datetime.date.fromisoformat(date_str) if date_str else datetime.date.today()
        except ValueError:
            return Response({"detail": "Invalid date format. Use YYYY-MM-DD."}, status=status.HTTP_400_BAD_REQUEST)

        try:
            threshold = int(request.query_params.get("threshold") or 75)
        except ValueError:
            return Response({"detail": "threshold must be an integer."}, status=status.HTTP_400_BAD_REQUEST)

        school_id = request.user.school_id

        class_groups = (
            StudentProfile.objects.filter(user__school_id=school_id, user__is_active=True)
            .values("class_grade", "section")
            .annotate(total_students=Count("id"))
            .order_by("class_grade", "section")
        )

        daily_stats = (
            Attendance.objects.filter(school_id=school_id, date=target_date)
            .values("student__student_profile__class_grade", "student__student_profile__section")
            .annotate(
                marked_count=Count("id"),
                present_count=Count("id", filter=Q(status__in=[Attendance.Status.PRESENT, Attendance.Status.LATE])),
                absent_count=Count("id", filter=Q(status=Attendance.Status.ABSENT)),
                medical_count=Count("id", filter=Q(status=Attendance.Status.MEDICAL)),
            )
        )
        stats_map = {
            (row["student__student_profile__class_grade"], row["student__student_profile__section"]): row
            for row in daily_stats
        }

        class_status = []
        total_present = total_absent = total_medical = total_active = 0

        for grp in class_groups:
            key = (grp["class_grade"], grp["section"])
            st = stats_map.get(key, {})
            marked = st.get("marked_count", 0)
            present = st.get("present_count", 0)
            absent = st.get("absent_count", 0)
            medical = st.get("medical_count", 0)

            total_active += grp["total_students"]
            total_present += present
            total_absent += absent
            total_medical += medical

            class_status.append({
                "class_grade": grp["class_grade"],
                "section": grp["section"],
                "total_students": grp["total_students"],
                "marked_count": marked,
                "present": present,
                "absent": absent,
                "medical": medical,
                "is_marked": marked > 0,
            })

        student_totals = (
            Attendance.objects.filter(school_id=school_id, student__is_active=True)
            .values(
                "student__username",
                "student__student_profile__first_name",
                "student__student_profile__last_name",
                "student__student_profile__class_grade",
                "student__student_profile__section",
                "student__student_profile__registered_phone",
            )
            .annotate(
                total_days=Count("id"),
                present_days=Count("id", filter=Q(status__in=[Attendance.Status.PRESENT, Attendance.Status.LATE])),
            )
        )

        defaulters = []
        for s in student_totals:
            if s["total_days"] == 0:
                continue
            pct = round((s["present_days"] / s["total_days"]) * 100, 1)
            if pct < threshold:
                defaulters.append({
                    "student_id": s["student__username"],
                    "name": f"{s['student__student_profile__first_name'] or ''} {s['student__student_profile__last_name'] or ''}".strip(),
                    "class_grade": s["student__student_profile__class_grade"],
                    "section": s["student__student_profile__section"],
                    "phone": s["student__student_profile__registered_phone"] or "",
                    "present_days": s["present_days"],
                    "total_days": s["total_days"],
                    "percentage": pct,
                })

        defaulters.sort(key=lambda x: x["percentage"])

        return Response(
            {
                "date": target_date.isoformat(),
                "threshold_percent": threshold,
                "school_summary": {
                    "total_active_students": total_active,
                    "present": total_present,
                    "absent": total_absent,
                    "medical": total_medical,
                },
                "class_wise_status": class_status,
                "defaulters_below_threshold": defaulters,
            },
            status=status.HTTP_200_OK,
        )


class MonthlyAttendanceRegisterView(APIView):
    """
    GET: Class & month ka 1..31 attendance register grid.
    Optional ?file_format=csv|xlsx|pdf pass karne par direct file download hoti hai.
    """

    permission_classes = [IsAuthenticated, IsTeacherOrSchoolAdmin]

    @extend_schema(
        summary="Get monthly attendance register or export as CSV/Excel/PDF",
        parameters=[
            OpenApiParameter(name="class_grade", type=str, required=True),
            OpenApiParameter(name="section", type=str, required=False),
            OpenApiParameter(name="month", type=int, required=False),
            OpenApiParameter(name="year", type=int, required=False),
            OpenApiParameter(name="file_format", type=str, required=False, description="csv, xlsx, or pdf"),
        ],
    )
    def get(self, request):
        school_id = request.user.school_id
        class_grade = (request.query_params.get("class_grade") or "").strip()
        section = (request.query_params.get("section") or "").strip()
        file_format = (request.query_params.get("file_format") or "").strip().lower()

        if not class_grade:
            return Response(
                {"detail": "class_grade query parameter is required."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        today = datetime.date.today()
        try:
            month = int(request.query_params.get("month") or today.month)
            year = int(request.query_params.get("year") or today.year)
            if not (1 <= month <= 12):
                raise ValueError
        except ValueError:
            return Response({"detail": "Invalid month or year."}, status=status.HTTP_400_BAD_REQUEST)

        _, num_days = calendar.monthrange(year, month)

        students_qs = StudentProfile.objects.select_related("user").filter(
            user__school_id=school_id,
            user__is_active=True,
            class_grade=class_grade,
        )
        if section:
            students_qs = students_qs.filter(section=section)
        students_qs = students_qs.order_by("roll_number", "first_name")

        records = Attendance.objects.filter(
            school_id=school_id,
            date__year=year,
            date__month=month,
            student__in=[s.user_id for s in students_qs],
        )

        code_map = {"PRESENT": "P", "ABSENT": "A", "MEDICAL": "M", "LATE": "L"}
        grid = {(r.student_id, r.date.day): code_map.get(r.status, r.status[0]) for r in records}

        register = []
        for sp in students_qs:
            days = {}
            p_cnt = a_cnt = m_cnt = 0
            for d in range(1, num_days + 1):
                val = grid.get((sp.user_id, d), "-")
                days[str(d)] = val
                if val in ("P", "L"):
                    p_cnt += 1
                elif val == "A":
                    a_cnt += 1
                elif val == "M":
                    m_cnt += 1

            marked_days = p_cnt + a_cnt + m_cnt
            pct = round((p_cnt / marked_days) * 100, 1) if marked_days > 0 else 0.0

            register.append({
                "student_id": sp.user.username,
                "roll_number": sp.roll_number,
                "name": f"{sp.first_name} {sp.last_name}".strip(),
                "days": days,
                "present": p_cnt,
                "absent": a_cnt,
                "medical": m_cnt,
                "percentage": pct,
            })

        if file_format in ("csv", "xlsx", "pdf"):
            headers = ["Roll", "Student ID", "Name"] + [str(d) for d in range(1, num_days + 1)] + ["P", "A", "M", "%"]
            rows = [
                [r["roll_number"] or "", r["student_id"], r["name"]]
                + [r["days"][str(d)] for d in range(1, num_days + 1)]
                + [r["present"], r["absent"], r["medical"], f"{r['percentage']}%"]
                for r in register
            ]
            title = f"EduSure School ({school_id}) - Class {class_grade}{section} Register ({month:02d}/{year})"
            filename = f"edusure_attendance_register_{school_id}_class_{class_grade}{section}_{year}_{month:02d}"

            if file_format == "csv":
                return export_to_csv(filename, headers, rows)
            if file_format == "xlsx":
                return export_to_excel(filename, "Register", headers, rows)
            return export_to_pdf(
                filename,
                title,
                f"Generated on {today.isoformat()} | Total Students: {len(rows)}",
                headers,
                rows,
            )

        return Response(
            {
                "class_grade": class_grade,
                "section": section,
                "month": month,
                "year": year,
                "days_in_month": num_days,
                "students": register,
            },
            status=status.HTTP_200_OK,
        )