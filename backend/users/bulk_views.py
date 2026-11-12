import pandas as pd
import datetime
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status, permissions
from rest_framework.parsers import MultiPartParser, FormParser
from drf_spectacular.utils import extend_schema
from django.db import transaction
from django.contrib.auth import get_user_model
from .models import StudentProfile
from .utils import ROLE_CODE_MAP

User = get_user_model()

class BulkStudentEnrollmentView(APIView):
    parser_classes = (MultiPartParser, FormParser)
    permission_classes = [permissions.AllowAny]

    @extend_schema(
        summary="Bulk enroll students via Excel/CSV file",
        request={
            "multipart/form-data": {
                "type": "object",
                "properties": {
                    "file": {
                        "type": "string",
                        "format": "binary",
                        "description": "Upload .xlsx or .csv file"
                    },
                    "school_code": {
                        "type": "string",
                        "default": "101"
                    }
                },
                "required": ["file"]
            }
        },
        responses={
            201: {
                "type": "object",
                "properties": {
                    "detail": {"type": "string"},
                    "total_processed": {"type": "integer"}
                }
            }
        }
    )
    @transaction.atomic  # Ensures either all rows are saved, or none if an error occurs
    def post(self, request):
        file = request.FILES.get('file')
        school_code = request.data.get('school_code', '101')

        if not file:
            return Response({"detail": "Excel/CSV file is required."}, status=status.HTTP_400_BAD_REQUEST)

        # Parse Excel or CSV
        try:
            df = pd.read_excel(file) if file.name.endswith(('.xlsx', '.xls')) else pd.read_csv(file)
        except Exception as e:
            return Response({"detail": f"File parsing error: {str(e)}"}, status=status.HTTP_400_BAD_REQUEST)

        # Basic prefix just in case the excel only has '1', '2' instead of full 10-digits
        year_suffix = datetime.datetime.now().strftime('%y')
        prefix = f"{school_code}{ROLE_CODE_MAP['STUDENT']}{year_suffix}"

        processed_count = 0

        for index, row in df.iterrows():
            # 1. Fetch exact User ID from Excel's 'userid' column
            raw_userid = ""
            # Ab hum 'userid' column read kar rahe hain
            if pd.notnull(row.get('userid')):
                raw_userid = str(int(row['userid'])) if isinstance(row['userid'], float) else str(row['userid']).strip()
            
            # Agar ID valid hai to use karein, warna auto-generate fallback
            if len(raw_userid) == 10:
                generated_id = raw_userid
            else:
                serial_num = int(raw_userid) if raw_userid.isdigit() else (index + 1)
                generated_id = f"{prefix}{serial_num:04d}"

            mobile = str(row.get('mobile_number', '')).strip()
            if mobile == 'nan': mobile = ''

            # Date of Birth Parsing
            dob_val = None
            if pd.notnull(row.get('dob')):
                try:
                    dob_val = pd.to_datetime(row['dob'], dayfirst=True).date()
                except Exception:
                    dob_val = None

            # 2. Duplicate Check: update_or_create use kiya hai
            # Agar ID exist karti hai to update hoga, nahi to ban jayega
            user, created = User.objects.update_or_create(
                username=generated_id,
                defaults={
                    'role': User.Role.STUDENT,
                    'school_id': int(school_code),
                    'requires_password_change': True,
                    'is_active': True,
                }
            )

            # Agar naya user (first time) bana hai tabhi common password assign karein
            if created:
                user.set_password("Student@12345")
                user.save()

            # 3. Profile update ya create karein
            StudentProfile.objects.update_or_create(
                user=user,
                defaults={
                    'admission_number': f"ADM-{generated_id}",
                    'first_name': str(row.get('first_name', '')).strip(),
                    'last_name': str(row.get('last_name', '')).strip(),
                    'class_grade': str(row.get('class', '')).strip(),
                    'section': str(row.get('section', '')).strip() if pd.notnull(row.get('section')) else '',
                    # Roll number ke liye ID ke aakhri digits nikal lenge
                    'roll_number': int(generated_id[-4:]) if generated_id[-4:].isdigit() else None,
                    'dob': dob_val,
                    'father_name': str(row.get('father_name', '')).strip(),
                    'registered_phone': mobile
                }
            )
            processed_count += 1

        return Response({
            "detail": f"Successfully processed {processed_count} students without duplicates.",
            "total_processed": processed_count
        }, status=status.HTTP_201_CREATED)