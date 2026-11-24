import datetime
import os
import pandas as pd
from django.conf import settings
from django.contrib.auth import get_user_model
from django.db import transaction
from drf_spectacular.utils import extend_schema
from rest_framework import status
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .serializers import generate_temp_password
from .models import StudentProfile
from .permissions import IsSchoolAdmin
from .signals import pause_excel_sync
from .utils import ROLE_CODE_MAP

User = get_user_model()


def _clean_int_str(val):
    """Float/string IDs (e.g. 1010260001.0) ko clean integer string ('1010260001') banata hai."""
    if val is None or (isinstance(val, float) and pd.isna(val)):
        return ""
    if isinstance(val, int):
        return str(val)
    if isinstance(val, float):
        return str(int(val))
    s = str(val).strip()
    if s.lower() in ("", "nan", "none", "null"):
        return ""
    if s.endswith(".0") and s[:-2].isdigit():
        return s[:-2]
    return s


class BulkStudentEnrollmentView(APIView):
    parser_classes = (MultiPartParser, FormParser)
    permission_classes = [IsAuthenticated, IsSchoolAdmin]

    @extend_schema(
        summary="Bulk enroll students via Excel/CSV file (supports any filename, multiple files & multi-sheet workbooks)",
        request={
            "multipart/form-data": {
                "type": "object",
                "properties": {
                    "file": {
                        "type": "string",
                        "format": "binary",
                        "description": "Upload .xlsx, .xls, or .csv file (any name)",
                    },
                    "school_code": {
                        "type": "string",
                        "default": "101",
                    },
                },
                "required": ["file"],
            }
        },
        responses={
            201: {
                "type": "object",
                "properties": {
                    "detail": {"type": "string"},
                    "saved_file": {"type": "string"},
                    "total_processed": {"type": "integer"},
                    "credentials": {"type": "array"},
                },
            }
        },
    )
    @transaction.atomic
    def post(self, request):
        file = request.FILES.get("file")
        admin_school_id = getattr(request.user, "school_id", None)
        school_code = str(admin_school_id or request.data.get("school_code", "101")).strip()

        if not file:
            return Response({"detail": "Excel/CSV file is required."}, status=status.HTTP_400_BAD_REQUEST)

        # 1. Read all sheets if Excel (.xlsx/.xls), or single table if CSV
        try:
            if file.name.lower().endswith((".xlsx", ".xls")):
                sheets_dict = pd.read_excel(file, sheet_name=None)
            else:
                sheets_dict = {"Sheet1": pd.read_csv(file)}
        except Exception as e:
            return Response({"detail": f"File parsing error: {str(e)}"}, status=status.HTTP_400_BAD_REQUEST)

        # 2. Save file locally under media/bulk_uploads/school_<school_code>/<original_filename>
        media_root = settings.MEDIA_ROOT or os.path.join(settings.BASE_DIR, "media")
        school_bulk_dir = os.path.join(media_root, "bulk_uploads", f"school_{school_code}")
        os.makedirs(school_bulk_dir, exist_ok=True)

        safe_filename = os.path.basename(file.name)
        ext = os.path.splitext(safe_filename)[1].lower()

        if ext == ".xls":
            base_name = os.path.splitext(safe_filename)[0]
            saved_path = os.path.join(school_bulk_dir, f"{base_name}.xlsx")
            with pd.ExcelWriter(saved_path, engine="openpyxl") as writer:
                for s_name, s_df in sheets_dict.items():
                    s_df.to_excel(writer, sheet_name=s_name, index=False)
        else:
            saved_path = os.path.join(school_bulk_dir, safe_filename)
            file.seek(0)
            with open(saved_path, "wb+") as dest:
                for chunk in file.chunks():
                    dest.write(chunk)

        year_suffix = datetime.datetime.now().strftime("%y")
        prefix = f"{school_code}{ROLE_CODE_MAP['STUDENT']}{year_suffix}"
        processed_count = 0
        created_credentials = []

        with pause_excel_sync():
            for sheet_name, df in sheets_dict.items():
                if df is None or df.empty:
                    continue

                df.columns = [str(c).strip().lower() for c in df.columns]

                for index, row in df.iterrows():
                    raw_userid = _clean_int_str(row.get("userid"))

                    if len(raw_userid) == 10 and raw_userid.isdigit():
                        generated_id = str(int(raw_userid))
                    else:
                        serial_num = int(raw_userid) if raw_userid.isdigit() else (processed_count + 1)
                        generated_id = f"{prefix}{serial_num:04d}"

                    mobile = _clean_int_str(row.get("mobile_number"))

                    dob_val = None
                    if pd.notnull(row.get("dob")):
                        try:
                            dob_val = pd.to_datetime(row["dob"], dayfirst=True).date()
                        except Exception:
                            dob_val = None

                    first_name = str(row.get("first_name", "")).strip()
                    if first_name.lower() == "nan":
                        first_name = ""

                    last_name = str(row.get("last_name", "")).strip()
                    if last_name.lower() == "nan":
                        last_name = ""

                    class_grade = _clean_int_str(row.get("class")) or str(row.get("class", "")).strip()
                    if class_grade.lower() == "nan":
                        class_grade = ""

                    section = str(row.get("section", "")).strip() if pd.notnull(row.get("section")) else ""
                    if section.lower() == "nan":
                        section = ""

                    father_name = str(row.get("father_name", "")).strip() if pd.notnull(row.get("father_name")) else ""
                    if father_name.lower() == "nan":
                        father_name = ""

                    user, created = User.objects.update_or_create(
                        username=generated_id,
                        defaults={
                            "first_name": first_name,
                            "last_name": last_name,
                            "role": User.Role.STUDENT,
                            "school_id": int(school_code),
                            "requires_password_change": True,
                            "is_active": True,
                        },
                    )

                    if created:
                        temp_password = generate_temp_password()
                        user.set_password(temp_password)
                        user.save()
                        created_credentials.append(
                            {
                                "user_id": generated_id,
                                "name": f"{first_name} {last_name}".strip(),
                                "class_grade": class_grade,
                                "section": section,
                                "roll_number": int(generated_id[-4:]) if generated_id[-4:].isdigit() else None,
                                "temporary_password": temp_password,
                            }
                        )

                    StudentProfile.objects.update_or_create(
                        user=user,
                        defaults={
                            "admission_number": f"ADM-{generated_id}",
                            "first_name": first_name,
                            "last_name": last_name,
                            "class_grade": class_grade,
                            "section": section,
                            "roll_number": int(generated_id[-4:]) if generated_id[-4:].isdigit() else None,
                            "dob": dob_val,
                            "father_name": father_name,
                            "registered_phone": mobile,
                        },
                    )
                    processed_count += 1

        return Response(
            {
                "detail": f"Successfully processed {processed_count} students from '{safe_filename}'.",
                "saved_file": saved_path,
                "total_processed": processed_count,
                "credentials": created_credentials,
            },
            status=status.HTTP_201_CREATED,
        )