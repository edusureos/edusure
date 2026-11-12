import re
from django.core.exceptions import ValidationError

class StrongPasswordValidator:
    def validate(self, password, user=None):
        if len(password) < 8:
            raise ValidationError("Password must be at least 8 characters long.")
        if not re.search(r'[A-Z]', password):
            raise ValidationError("Password must contain at least 1 uppercase letter (A-Z).")
        if not re.search(r'[a-z]', password):
            raise ValidationError("Password must contain at least 1 lowercase letter (a-z).")
        if not re.search(r'[0-9]', password):
            raise ValidationError("Password must contain at least 1 digit (0-9).")
        if not re.search(r'[@$!%*?&#]', password):
            raise ValidationError("Password must contain at least 1 special character (@, $, !, %, *, ?, &, #).")

    def get_help_text(self):
        return "Password must be at least 8 characters, include uppercase, lowercase, number, and special character."