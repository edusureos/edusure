import random
import re
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework_simplejwt.views import TokenObtainPairView
from rest_framework_simplejwt.tokens import RefreshToken
from drf_spectacular.utils import extend_schema
from rest_framework import status, permissions
from firebase_admin import auth as firebase_auth
from django.contrib.auth import get_user_model
from .models import User, OTPStore
from .serializers import (
    UserProfileSerializer,
    CustomLoginSerializer,
    FirstLoginPasswordChangeSerializer,
    UserSerializer,
    SendOTPSerializer,
    VerifyOTPAndResetPasswordSerializer,
    FirebaseLoginSerializer,
    AdminCreateStudentSerializer,
    AdminStudentListSerializer,
    AdminTeacherSerializer,
    NoticeSerializer,
    BulkMarkAttendanceSerializer,
    StudentAttendanceRecordSerializer,
)
from .export_utils import export_to_csv, export_to_excel, export_to_pdf
from django.db.models import Q, Count
from .permissions import IsSchoolAdmin
from .models import StudentProfile
from .serializers import AdminCreateStudentSerializer, AdminStudentListSerializer
from django.shortcuts import get_object_or_404
from .models import TeacherProfile, Notice
from .serializers import AdminTeacherSerializer, NoticeSerializer
import datetime
from django.db import transaction
from .models import StudentProfile, TeacherProfile, Notice, Attendance
from .permissions import IsSchoolAdmin, IsTeacherOrSchoolAdmin


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
                status=status.HTTP_200_OK
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

        return Response({"detail": "OTP sent successfully via SMS.", "phone_number": user.phone_number}, status=status.HTTP_200_OK)

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
        responses={200: UserProfileSerializer}
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

        return Response({
            "username": user.username,
            "role": user.role,
            "studentName": full_name,
            "class": class_display,
            "dateOfBirth": dob_display,
            "fatherName": father_name,
            "mobileNumber": mobile,
        }, status=status.HTTP_200_OK)

    
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

# ==========================================
# Firebase Phone Auth Login View
# ==========================================
class FirebaseLoginView(APIView):
    permission_classes = [permissions.AllowAny]

    @extend_schema(
        summary="Login using Firebase Phone Auth ID Token",
        request=FirebaseLoginSerializer,
        responses={200: "JWT Access & Refresh Tokens"}
    )
    def post(self, request):
        serializer = FirebaseLoginSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        id_token = serializer.validated_data['id_token']

        try:
            # 1. Verify token with Firebase
            decoded_token = firebase_auth.verify_id_token(id_token)
            firebase_phone = decoded_token.get('phone_number')

            if not firebase_phone:
                return Response({"error": "No phone number found in token."}, status=status.HTTP_400_BAD_REQUEST)

            # 2. Extract last 10 digits to match country codes safely
            phone_clean = firebase_phone[-10:]

            # Lookup on User model first
            user = get_user_model().objects.filter(phone_number__endswith=phone_clean).first()

            # Fallback to student_profile if not found directly
            if not user:
                user = get_user_model().objects.filter(
                    student_profile__registered_phone__endswith=phone_clean
                ).first()

            if not user:
                return Response(
                    {"error": "User with this phone number not found in our ERP."}, 
                    status=status.HTTP_404_NOT_FOUND
                )

            # 3. Issue DRF JWT Tokens
            refresh = RefreshToken.for_user(user)
            
            return Response({
                'refresh': str(refresh),
                'access': str(refresh.access_token),
                'role': getattr(user, 'role', 'student'),
                'username': user.username
            }, status=status.HTTP_200_OK)

        except firebase_auth.InvalidIdTokenError:
            return Response({"error": "Invalid or expired Firebase token."}, status=status.HTTP_401_UNAUTHORIZED)
        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class AdminStudentListCreateView(APIView):
    permission_classes = [IsAuthenticated, IsSchoolAdmin]

    @extend_schema(
        summary="List & search students in Admin's school",
        responses={200: AdminStudentListSerializer(many=True)}
    )
    def get(self, request):
        school_id = request.user.school_id
        qs = StudentProfile.objects.select_related('user').filter(user__school_id=school_id)

        # Optional query filters: ?class_grade=10&section=A&search=Rahul
        class_grade = request.query_params.get('class_grade')
        section = request.query_params.get('section')
        search = request.query_params.get('search')

        if class_grade:
            qs = qs.filter(class_grade=class_grade)
        if section:
            qs = qs.filter(section=section)
        if search:
            qs = qs.filter(
                Q(user__username__icontains=search) |
                Q(first_name__icontains=search) |
                Q(last_name__icontains=search) |
                Q(admission_number__icontains=search)
            )

        serializer = AdminStudentListSerializer(qs.order_by('class_grade', 'roll_number'), many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)

    @extend_schema(
        summary="Create a new student with auto-generated 10-digit ID",
        request=AdminCreateStudentSerializer,
        responses={201: AdminCreateStudentSerializer}
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
            return Response(serializer.data, status=status.HTTP_200_OK)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class AdminTeacherListCreateView(APIView):
    permission_classes = [IsAuthenticated, IsSchoolAdmin]

    @extend_schema(summary="List all teachers in Admin's school", responses={200: AdminTeacherSerializer(many=True)})
    def get(self, request):
        qs = TeacherProfile.objects.select_related('user').filter(user__school_id=request.user.school_id)
        serializer = AdminTeacherSerializer(qs.order_by('first_name'), many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)

    @extend_schema(summary="Onboard a new teacher with auto 10-digit ID", request=AdminTeacherSerializer, responses={201: AdminTeacherSerializer})
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
    """GET: Students/Teachers/Admins view school notices | POST: Admin creates notice"""
    permission_classes = [IsAuthenticated]

    @extend_schema(summary="Fetch notices for logged-in user's school & role", responses={200: NoticeSerializer(many=True)})
    def get(self, request):
        user = request.user
        qs = Notice.objects.select_related('created_by').filter(school_id=user.school_id)

        # Admin ko school ke saare notices dikhenge
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
                        # Agar target_classes khali hai toh sab classes ko dikhega, warna sirf selected classes ko
                        if not classes or (student_class and student_class in classes):
                            notices.append(notice)

        serializer = NoticeSerializer(notices, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)

    @extend_schema(summary="Publish a new notice (Admin only)", request=NoticeSerializer, responses={201: NoticeSerializer})
    def post(self, request):
        if request.user.role not in [User.Role.SCHOOL_ADMIN, User.Role.SUPER_ADMIN]:
            return Response({"detail": "Only School Admins can publish notices."}, status=status.HTTP_403_FORBIDDEN)

        serializer = NoticeSerializer(data=request.data)
        if serializer.is_valid():
            serializer.save(school_id=request.user.school_id, created_by=request.user)
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
          

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

        students_qs = StudentProfile.objects.select_related('user').filter(
            user__school_id=school_id,
            user__is_active=True,
            class_grade=class_grade
        )
        if section:
            students_qs = students_qs.filter(section=section)

        students_qs = students_qs.order_by('roll_number', 'first_name')

        existing_records = {
            att.student_id: att
            for att in Attendance.objects.filter(
                school_id=school_id,
                date=target_date,
                student__in=[s.user_id for s in students_qs]
            )
        }

        roll_call = []
        for sp in students_qs:
            att = existing_records.get(sp.user_id)
            roll_call.append({
                "student_id": sp.user.username,
                "roll_number": sp.roll_number,
                "name": f"{sp.first_name} {sp.last_name}".strip(),
                "class_grade": sp.class_grade,
                "section": sp.section,
                "status": att.status if att else "UNMARKED",
                "remarks": att.remarks if att else "",
            })

        return Response({
            "date": str(target_date),
            "class_grade": class_grade,
            "section": section,
            "total_students": len(roll_call),
            "students": roll_call,
        }, status=status.HTTP_200_OK)

    @extend_schema(
        summary="Mark or update attendance in bulk for a date",
        request=BulkMarkAttendanceSerializer
    )
    def post(self, request):
        serializer = BulkMarkAttendanceSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        school_id = request.user.school_id
        target_date = serializer.validated_data['date']
        records = serializer.validated_data['records']

        student_usernames = [item['student_id'] for item in records]
        valid_students = {
            u.username: u
            for u in User.objects.filter(
                username__in=student_usernames,
                school_id=school_id,
                role=User.Role.STUDENT
            )
        }

        invalid_ids = [sid for sid in student_usernames if sid not in valid_students]
        if invalid_ids:
            return Response(
                {"detail": f"Invalid student IDs for your school: {', '.join(invalid_ids)}"},
                status=status.HTTP_400_BAD_REQUEST
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
                    }
                )

        return Response({
            "detail": f"Attendance saved for {len(records)} students.",
            "date": str(target_date),
        }, status=status.HTTP_200_OK)


class StudentAttendanceSummaryView(APIView):
    """Fetch attendance percentage and daily history for a student"""
    permission_classes = [IsAuthenticated]

    @extend_schema(summary="Get student attendance summary & history")
    def get(self, request):
        user = request.user

        # Admin/Teacher can inspect any student via ?student_id=1010260001
        if user.role in [User.Role.TEACHER, User.Role.SCHOOL_ADMIN, User.Role.SUPER_ADMIN]:
            student_id = request.query_params.get('student_id')
            if not student_id:
                return Response({"detail": "student_id query param is required."}, status=status.HTTP_400_BAD_REQUEST)
            target_user = get_object_or_404(
                User, username=student_id, school_id=user.school_id, role=User.Role.STUDENT
            )
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

        effective_present = present_days + late_days
        percentage = round((effective_present / total_days) * 100, 1) if total_days > 0 else 0.0

        serializer = StudentAttendanceRecordSerializer(qs[:60], many=True)
        return Response({
            "student_id": target_user.username,
            "total_days": total_days,
            "present_days": present_days,
            "late_days": late_days,
            "absent_days": absent_days,
            "attendance_percentage": percentage,
            "records": serializer.data,
        }, status=status.HTTP_200_OK)


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

        return Response({
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
        }, status=status.HTTP_200_OK)      



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
            qs = StudentProfile.objects.select_related('user').filter(
                user__school_id=school_id
            ).order_by('class_grade', 'section', 'roll_number', 'first_name')

            class_grade = request.query_params.get('class_grade')
            section = request.query_params.get('section')
            if class_grade:
                qs = qs.filter(class_grade=class_grade)
            if section:
                qs = qs.filter(section=section)

            headers = [
                'Student ID', 'Full Name', 'Class', 'Section',
                'Roll No', 'Guardian Name', 'Contact', 'Status'
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
                'Qualification', 'Class Teacher Of', 'Contact', 'Status'
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
                'Section', 'Status', 'Remarks', 'Marked By'
            ]
            rows = []
            for att in qs:
                sp = getattr(att.student, 'student_profile', None)
                student_name = (
                    f"{sp.first_name} {sp.last_name}".strip()
                    if sp else att.student.username
                )
                rows.append([
                    str(att.date),
                    att.student.username,
                    student_name,
                    sp.class_grade if sp else '',
                    sp.section if sp else '',
                    att.status,
                    att.remarks,
                    att.marked_by.username if att.marked_by else '',
                ])
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