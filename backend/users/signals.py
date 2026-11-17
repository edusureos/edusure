import csv
import os
import re
import threading
from contextlib import contextmanager
from django.conf import settings
from django.db import transaction
from django.db.models.signals import post_delete, post_save
from django.dispatch import receiver
from openpyxl import Workbook, load_workbook

from .models import StudentProfile, User

_thread_locals = threading.local()
_locks_guard = threading.Lock()
_school_locks = {}


def _get_school_lock(school_id):
    with _locks_guard:
        if school_id not in _school_locks:
            _school_locks[school_id] = threading.Lock()
        return _school_locks[school_id]


@contextmanager
def pause_excel_sync():
    """Prevents redundant file writes during bulk upload."""
    _thread_locals.paused = True
    try:
        yield
    finally:
        _thread_locals.paused = False


def _is_sync_paused():
    return getattr(_thread_locals, "paused", False)


COLUMN_TO_FIELD = {
    "userid": "userid",
    "first_name": "first_name",
    "last_name": "last_name",
    "class": "class_grade",
    "section": "section",
    "dob": "dob",
    "father_name": "father_name",
    "mobile_number": "registered_phone",
}

DEFAULT_HEADERS = [
    "userid",
    "first_name",
    "last_name",
    "class",
    "section",
    "dob",
    "father_name",
    "mobile_number",
]


def get_school_bulk_dir(school_id):
    media_root = settings.MEDIA_ROOT or os.path.join(settings.BASE_DIR, "media")
    school_dir = os.path.join(media_root, "bulk_uploads", f"school_{school_id}")
    os.makedirs(school_dir, exist_ok=True)
    return school_dir


def list_school_bulk_files(school_id):
    """Returns all .xlsx and .csv files for a school, sorted by most recently modified."""
    school_dir = get_school_bulk_dir(school_id)
    files = []
    for fname in os.listdir(school_dir):
        if fname.startswith("~$"):
            continue
        if fname.lower().endswith((".xlsx", ".csv")):
            files.append(os.path.join(school_dir, fname))
    files.sort(key=lambda p: os.path.getmtime(p), reverse=True)
    return files


def _to_clean_int(val):
    if val is None:
        return None
    if isinstance(val, int):
        return val
    if isinstance(val, float):
        return int(val)
    s = str(val).strip()
    if s.endswith(".0") and s[:-2].isdigit():
        return int(s[:-2])
    if s.isdigit():
        return int(s)
    return None


def _normalize_class_str(val):
    if val is None:
        return ""
    s = str(val).strip().lower()
    if s.endswith(".0") and s[:-2].isdigit():
        s = s[:-2]
    s = re.sub(r"^class\s*", "", s)
    s = re.sub(r"^(\d+)(st|nd|rd|th)$", r"\1", s)
    return s.strip()


def _build_row_data(user, profile):
    dob_str = ""
    if profile and profile.dob:
        dob_str = profile.dob.strftime("%d-%m-%Y")

    uid_int = _to_clean_int(user.username)
    return {
        "userid": uid_int if uid_int is not None else user.username,
        "first_name": profile.first_name if profile else (user.first_name or ""),
        "last_name": profile.last_name if profile else (user.last_name or ""),
        "class_grade": (profile.class_grade or "") if profile else "",
        "section": (profile.section or "") if profile else "",
        "dob": dob_str,
        "father_name": (profile.father_name or "") if profile else "",
        "registered_phone": (profile.registered_phone or "") if profile else "",
    }


def _matches_userid(cell_value, username):
    target_int = _to_clean_int(username)
    cell_int = _to_clean_int(cell_value)

    if target_int is not None and cell_int is not None:
        if cell_int == target_int:
            return True
        if cell_int < 10000 and str(target_int).endswith(f"{cell_int:04d}"):
            return True
        return False

    return str(cell_value or "").strip() == str(username).strip()


def _write_xlsx_row(ws, row_idx, col_map, payload):
    for col_idx, field_key in col_map.items():
        val = payload.get(field_key, "")
        cell = ws.cell(row=row_idx, column=col_idx)
        if field_key == "userid":
            int_val = _to_clean_int(val)
            cell.value = int_val if int_val is not None else val
            cell.number_format = "0"
        else:
            cell.value = val


def _map_headers(header_values):
    col_map = {}
    userid_col = None
    class_col = None
    for idx, raw_h in enumerate(header_values):
        if raw_h is None:
            continue
        key = str(raw_h).strip().lower()
        if key in COLUMN_TO_FIELD:
            field_key = COLUMN_TO_FIELD[key]
            col_map[idx] = field_key
            if field_key == "userid":
                userid_col = idx
            elif field_key == "class_grade":
                class_col = idx
    return col_map, userid_col, class_col


def find_file_for_class(files, class_grade):
    """Finds the specific file (and sheet name) matching a given class_grade."""
    target_class = _normalize_class_str(class_grade)
    if not target_class:
        return None, None

    for file_path in files:
        fname_norm = _normalize_class_str(os.path.splitext(os.path.basename(file_path))[0])
        if file_path.endswith(".xlsx"):
            try:
                wb = load_workbook(file_path, read_only=True)
                for ws in wb.worksheets:
                    rows_iter = ws.iter_rows(values_only=True)
                    headers = next(rows_iter, None)
                    if not headers:
                        continue
                    _, userid_col, class_col = _map_headers(headers)
                    if userid_col is None:
                        continue

                    if _normalize_class_str(ws.title) == target_class or fname_norm == target_class:
                        wb.close()
                        return file_path, ws.title

                    if class_col is not None:
                        for row_vals in rows_iter:
                            if class_col < len(row_vals) and _normalize_class_str(row_vals[class_col]) == target_class:
                                wb.close()
                                return file_path, ws.title
                wb.close()
            except Exception:
                continue

        elif file_path.endswith(".csv"):
            if fname_norm == target_class:
                return file_path, None
            try:
                with open(file_path, mode="r", newline="", encoding="utf-8-sig") as f:
                    reader = csv.reader(f)
                    headers = next(reader, None)
                    if headers:
                        _, userid_col, class_col = _map_headers(headers)
                        if userid_col is not None and class_col is not None:
                            for r in reader:
                                if class_col < len(r) and _normalize_class_str(r[class_col]) == target_class:
                                    return file_path, None
            except Exception:
                continue

    return None, None


def _search_and_update_in_files(files, target_username, payload, deleted=False):
    for file_path in files:
        try:
            if file_path.endswith(".xlsx"):
                wb = load_workbook(file_path)
                modified = False

                for ws in wb.worksheets:
                    if ws.max_row < 1:
                        continue
                    headers = [ws.cell(row=1, column=c).value for c in range(1, ws.max_column + 1)]
                    col_map_0, userid_col_0, _ = _map_headers(headers)
                    if userid_col_0 is None:
                        continue

                    col_map = {k + 1: v for k, v in col_map_0.items()}
                    userid_col = userid_col_0 + 1

                    for r in range(2, ws.max_row + 1):
                        if _matches_userid(ws.cell(row=r, column=userid_col).value, target_username):
                            if deleted:
                                ws.delete_rows(r)
                            else:
                                _write_xlsx_row(ws, r, col_map, payload)
                            modified = True
                            break
                    if modified:
                        break

                if modified:
                    wb.save(file_path)
                    return True

            elif file_path.endswith(".csv"):
                with open(file_path, mode="r", newline="", encoding="utf-8-sig") as f:
                    reader = list(csv.reader(f))
                if not reader:
                    continue

                col_map, userid_col, _ = _map_headers(reader[0])
                if userid_col is None:
                    continue

                for r_idx in range(1, len(reader)):
                    row = reader[r_idx]
                    if userid_col < len(row) and _matches_userid(row[userid_col], target_username):
                        if deleted:
                            reader.pop(r_idx)
                        else:
                            while len(row) < len(reader[0]):
                                row.append("")
                            for idx, field_key in col_map.items():
                                row[idx] = str(payload.get(field_key, ""))

                        with open(file_path, mode="w", newline="", encoding="utf-8-sig") as f:
                            csv.writer(f).writerows(reader)
                        return True

        except PermissionError:
            print(f"[EXCEL SYNC ERROR] File is open in another program: '{file_path}'")
            return True

    return False


def _append_new_student_to_best_file(school_id, files, payload):
    if not files:
        school_dir = get_school_bulk_dir(school_id)
        master_path = os.path.join(school_dir, "students_master.xlsx")
        wb = Workbook()
        ws = wb.active
        ws.title = "Students"
        ws.append(DEFAULT_HEADERS)
        col_map = {idx + 1: COLUMN_TO_FIELD[h] for idx, h in enumerate(DEFAULT_HEADERS)}
        _write_xlsx_row(ws, 2, col_map, payload)
        wb.save(master_path)
        return

    chosen_file, chosen_sheet = find_file_for_class(files, payload.get("class_grade"))
    if not chosen_file:
        chosen_file = files[0]

    try:
        if chosen_file.endswith(".xlsx"):
            wb = load_workbook(chosen_file)
            ws = wb[chosen_sheet] if (chosen_sheet and chosen_sheet in wb.sheetnames) else wb.active
            headers = [ws.cell(row=1, column=c).value for c in range(1, ws.max_column + 1)]
            col_map_0, userid_col_0, _ = _map_headers(headers)
            if userid_col_0 is not None:
                col_map = {k + 1: v for k, v in col_map_0.items()}
                _write_xlsx_row(ws, ws.max_row + 1, col_map, payload)
                wb.save(chosen_file)

        elif chosen_file.endswith(".csv"):
            with open(chosen_file, mode="r", newline="", encoding="utf-8-sig") as f:
                reader = list(csv.reader(f))
            if reader:
                col_map, userid_col, _ = _map_headers(reader[0])
                if userid_col is not None:
                    new_row = [""] * len(reader[0])
                    for idx, field_key in col_map.items():
                        new_row[idx] = str(payload.get(field_key, ""))
                    reader.append(new_row)
                    with open(chosen_file, mode="w", newline="", encoding="utf-8-sig") as f:
                        csv.writer(f).writerows(reader)
    except PermissionError:
        print(f"[EXCEL SYNC ERROR] File is open in another program: '{chosen_file}'")


def sync_student_to_uploaded_file(user_id, school_id, deleted=False, old_username=None):
    if not school_id:
        return

    with _get_school_lock(school_id):
        files = list_school_bulk_files(school_id)

        if deleted:
            if files and old_username:
                _search_and_update_in_files(files, old_username, None, deleted=True)
            return

        user = User.objects.filter(id=user_id).first()
        if not user:
            return
        profile = StudentProfile.objects.filter(user=user).first()
        payload = _build_row_data(user, profile)

        found = _search_and_update_in_files(files, user.username, payload, deleted=False)
        if not found:
            _append_new_student_to_best_file(school_id, files, payload)


@receiver(post_save, sender=StudentProfile)
def on_student_profile_saved(sender, instance, **kwargs):
    if _is_sync_paused():
        return
    user = instance.user
    if user and user.school_id:
        transaction.on_commit(lambda: sync_student_to_uploaded_file(user.id, user.school_id))


@receiver(post_save, sender=User)
def on_student_user_saved(sender, instance, created=False, **kwargs):
    if _is_sync_paused() or created:
        return
    if getattr(instance, "role", None) == User.Role.STUDENT and instance.school_id:
        transaction.on_commit(lambda: sync_student_to_uploaded_file(instance.id, instance.school_id))


@receiver(post_delete, sender=User)
def on_student_user_deleted(sender, instance, **kwargs):
    if _is_sync_paused():
        return
    if getattr(instance, "role", None) == User.Role.STUDENT and instance.school_id:
        username = instance.username
        user_id = instance.id
        school_id = instance.school_id
        transaction.on_commit(
            lambda: sync_student_to_uploaded_file(user_id, school_id, deleted=True, old_username=username)
        )