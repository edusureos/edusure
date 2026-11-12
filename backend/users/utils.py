import datetime
from django.db import transaction
from django.contrib.auth import get_user_model

ROLE_CODE_MAP = {
    'STUDENT': '0',
    'TEACHER': '1',
    'SCHOOL_ADMIN': '2',
}

def generate_user_id(role: str, school_code: str = "101") -> str:
    """
    Generates 10-digit ID format: [SCHOOL(3)][ROLE(1)][YEAR(2)][SERIAL(4)]
    Example output for Student in 2026: '1010260001'
    """
    User = get_user_model()
    role_digit = ROLE_CODE_MAP.get(role.upper(), '0')
    year_suffix = datetime.datetime.now().strftime('%y')

    prefix = f"{school_code}{role_digit}{year_suffix}"

    with transaction.atomic():
        last_user = (
            User.objects.filter(username__startswith=prefix)
            .order_by('-username')
            .first()
        )

        if last_user and len(last_user.username) == 10 and last_user.username.isdigit():
            last_serial = int(last_user.username[-4:])
            new_serial = last_serial + 1
        else:
            new_serial = 1

        return f"{prefix}{new_serial:04d}"