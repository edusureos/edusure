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

from .models import StudentProfile
from .permissions import IsSchoolAdmin
from .serializers import generate_temp_password
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


def _clean_str(val):
    if val is None or (isinstance(val, float) and pd.isna(val)):
        return ""
    s = str(val).strip()
    return "" if s.lower() in ("nan", "none", "null") else s


class BulkStudentEnrollmentView(APIView):
    parser_classes = (MultiPartParser, FormParser)
    permission_classes = [IsAuthenticated, IsSchoolAdmin]

    @extend_schema(
        summary="Bulk enroll students via Excel/CSV file (preserves existing credentials, updates profiles/roll numbers, and generates credentials only for new students)",
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
                    "newly_created": {"type": "integer"},
                    "updated_existing": {"type": "integer"},
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
        school_student_prefix = f"{school_code}{ROLE_CODE_MAP['STUDENT']}"
        prefix = f"{school_student_prefix}{year_suffix}"

        # Find highest existing serial number for this school & year so new students never collide
        existing_usernames = User.objects.filter(
            username__startswith=prefix,
        ).values_list("username", flat=True)

        max_serial = 0
        for uname in existing_usernames:
            if len(uname) == 10 and uname.isdigit():
                max_serial = max(max_serial, int(uname[-4:]))

        processed_count = 0
        updated_count = 0
        created_credentials = []

        with pause_excel_sync():
            for sheet_name, df in sheets_dict.items():
                if df is None or df.empty:
                    continue

                df.columns = [str(c).strip().lower() for c in df.columns]

                for index, row in df.iterrows():
                    raw_userid = _clean_int_str(row.get("userid"))
                    mobile = _clean_int_str(row.get("mobile_number"))

                    dob_val = None
                    if pd.notnull(row.get("dob")):
                        try:
                            dob_val = pd.to_datetime(row["dob"], dayfirst=True).date()
                        except Exception:
                            dob_val = None

                    first_name = _clean_str(row.get("first_name"))
                    last_name = _clean_str(row.get("last_name"))
                    class_grade = _clean_int_str(row.get("class")) or _clean_str(row.get("class"))
                    section = _clean_str(row.get("section"))
                    father_name = _clean_str(row.get("father_name"))

                    raw_roll = (
                        _clean_int_str(row.get("roll_number"))
                        or _clean_int_str(row.get("roll_no"))
                        or _clean_int_str(row.get("roll"))
                    )
                    parsed_roll = int(raw_roll) if raw_roll.isdigit() else None

                    # Reject cross-school or non-student 10-digit IDs if explicitly passed in Excel
                    if len(raw_userid) == 10 and raw_userid.isdigit():
                        if not raw_userid.startswith(school_student_prefix):
                            transaction.set_rollback(True)
                            return Response(
                                {
                                    "detail": (
                                        f"Sheet '{sheet_name}' row {index + 2}: User ID '{raw_userid}' "
                                        f"does not belong to school {school_code} students."
                                    )
                                },
                                status=status.HTTP_400_BAD_REQUEST,
                            )

                    # 1. Match existing student in this school (so ID & password stay untouched)
                    existing_user = None
                    if len(raw_userid) == 10 and raw_userid.isdigit():
                        existing_user = User.objects.filter(
                            username=raw_userid,
                            role=User.Role.STUDENT,
                            school_id=int(school_code),
                        ).first()
                    elif first_name and mobile:
                        prof = (
                            StudentProfile.objects.filter(
                                user__school_id=int(school_code),
                                user__role=User.Role.STUDENT,
                                first_name__iexact=first_name,
                                last_name__iexact=last_name,
                                registered_phone=mobile,
                            )
                            .select_related("user")
                            .first()
                        )
                        if prof:
                            existing_user = prof.user
                    elif first_name and father_name:
                        prof_qs = StudentProfile.objects.filter(
                            user__school_id=int(school_code),
                            user__role=User.Role.STUDENT,
                            first_name__iexact=first_name,
                            last_name__iexact=last_name,
                            father_name__iexact=father_name,
                        ).select_related("user")
                        if dob_val:
                            prof_qs = prof_qs.filter(dob=dob_val)
                        prof = prof_qs.first()
                        if prof:
                            existing_user = prof.user

                    if existing_user:
                        # EXISTING STUDENT: Do NOT change username, password, or requires_password_change
                        user = existing_user
                        generated_id = user.username
                        update_fields = []
                        if first_name and user.first_name != first_name:
                            user.first_name = first_name
                            update_fields.append("first_name")
                        if last_name and user.last_name != last_name:
                            user.last_name = last_name
                            update_fields.append("last_name")
                        if update_fields:
                            user.save(update_fields=update_fields)
                        updated_count += 1
                    else:
                        # NEW STUDENT: Generate next sequential ID & fresh temporary password
                        if len(raw_userid) == 10 and raw_userid.isdigit():
                            generated_id = raw_userid
                            if generated_id.startswith(prefix):
                                max_serial = max(max_serial, int(generated_id[-4:]))
                        else:
                            max_serial += 1
                            generated_id = f"{prefix}{max_serial:04d}"

                        temp_password = generate_temp_password()
                        user = User.objects.create_user(
                            username=generated_id,
                            password=temp_password,
                            first_name=first_name,
                            last_name=last_name,
                            role=User.Role.STUDENT,
                            school_id=int(school_code),
                            requires_password_change=True,
                            is_active=True,
                        )
                        final_roll = parsed_roll if parsed_roll is not None else int(generated_id[-4:])
                        created_credentials.append(
                            {
                                "user_id": generated_id,
                                "name": f"{first_name} {last_name}".strip(),
                                "class_grade": class_grade,
                                "section": section,
                                "roll_number": final_roll,
                                "temporary_password": temp_password,
                            }
                        )

                    existing_profile = StudentProfile.objects.filter(user=user).first()
                    final_roll = (
                        parsed_roll
                        if parsed_roll is not None
                        else (existing_profile.roll_number if existing_profile else int(generated_id[-4:]))
                    )

                    StudentProfile.objects.update_or_create(
                        user=user,
                        defaults={
                            "admission_number": f"ADM-{generated_id}",
                            "first_name": first_name or (existing_profile.first_name if existing_profile else ""),
                            "last_name": last_name or (existing_profile.last_name if existing_profile else ""),
                            "class_grade": class_grade or (existing_profile.class_grade if existing_profile else ""),
                            "section": section or (existing_profile.section if existing_profile else ""),
                            "roll_number": final_roll,
                            "dob": dob_val or (existing_profile.dob if existing_profile else None),
                            "father_name": father_name or (existing_profile.father_name if existing_profile else ""),
                            "registered_phone": mobile or (existing_profile.registered_phone if existing_profile else ""),
                        },
                    )
                    processed_count += 1

        return Response(
            {
                "detail": (
                    f"Processed {processed_count} students from '{safe_filename}' "
                    f"({len(created_credentials)} new, {updated_count} updated)."
                ),
                "saved_file": saved_path,
                "total_processed": processed_count,
                "newly_created": len(created_credentials),
                "updated_existing": updated_count,
                "credentials": created_credentials,
            },
            status=status.HTTP_201_CREATED,
        )