import datetime
from django.db import transaction
from django.contrib.auth import get_user_model
import secrets


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



def generate_temp_password(length: int = 8) -> str:
    """
    Generates an unambiguous random strong password matching StrongPasswordValidator.
    Excludes confusing characters (0, O, 1, l, I) for easy reading on class slips.
    """
    upper = "ABCDEFGHJKLMNPQRSTUVWXYZ"
    lower = "abcdefghijkmnopqrstuvwxyz"
    digits = "23456789"
    special = "@$!%*?&#"

    password_chars = [
        secrets.choice(upper),
        secrets.choice(lower),
        secrets.choice(digits),
        secrets.choice(special),
    ]
    all_chars = upper + lower + digits + special
    password_chars += [secrets.choice(all_chars) for _ in range(length - 4)]
    secrets.SystemRandom().shuffle(password_chars)
    return "".join(password_chars)    