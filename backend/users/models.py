from django.contrib.auth.models import AbstractUser, BaseUserManager
from django.db import models


class CustomUserManager(BaseUserManager):
    def create_user(self, username, password=None, **extra_fields):
        if not username:
            raise ValueError('The Username field must be set')
        user = self.model(username=username, **extra_fields)
        if password:
            user.set_password(password)
        else:
            user.set_unusable_password()
        user.save(using=self._db)
        return user

    def create_superuser(self, username, password=None, **extra_fields):
        extra_fields.setdefault('is_staff', True)
        extra_fields.setdefault('is_superuser', True)
        extra_fields.setdefault('role', 'SUPER_ADMIN')
        return self.create_user(username, password, **extra_fields)


class User(AbstractUser):
    email = None
    
    class Role(models.TextChoices):
        SUPER_ADMIN = 'SUPER_ADMIN', 'Super Admin'
        SCHOOL_ADMIN = 'SCHOOL_ADMIN', 'School Admin'
        TEACHER = 'TEACHER', 'Teacher'
        STUDENT = 'STUDENT', 'Student'

    role = models.CharField(max_length=20, choices=Role.choices, default=Role.STUDENT)
    phone_number = models.CharField(max_length=15, unique=True, null=True, blank=True)
    requires_password_change = models.BooleanField(default=True)
    school_id = models.IntegerField(null=True, blank=True)

    REQUIRED_FIELDS = []

    objects = CustomUserManager()

    class Meta:
        indexes = [
            models.Index(fields=['username', 'school_id']),
            models.Index(fields=['role', 'school_id']),
        ]

    def save(self, *args, **kwargs):
        if not self.is_superuser and self.username:
            # 10-Digit ID Pattern Logic: [SCHOOL(3)][ROLE_DIGIT(1)][YEAR(2)][SERIAL(4)]
            # Example: '1010260001' -> 4th digit (index 3) defines role
            if len(self.username) == 10 and self.username.isdigit():
                role_digit = self.username[3]
                if role_digit == '0':
                    self.role = self.Role.STUDENT
                elif role_digit == '1':
                    self.role = self.Role.TEACHER
                elif role_digit == '2':
                    self.role = self.Role.SCHOOL_ADMIN
            
        super().save(*args, **kwargs)


class StudentProfile(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='student_profile')
    admission_number = models.CharField(max_length=20, unique=True, null=True, blank=True)
    first_name = models.CharField(max_length=50, blank=True)
    last_name = models.CharField(max_length=50, blank=True)
    class_grade = models.CharField(max_length=10, null=True, blank=True)
    section = models.CharField(max_length=5, null=True, blank=True)
    roll_number = models.PositiveIntegerField(null=True, blank=True)
    dob = models.DateField(null=True, blank=True)
    blood_group = models.CharField(max_length=5, blank=True)
    father_name = models.CharField(max_length=100, blank=True)
    registered_phone = models.CharField(max_length=15, blank=True)
    address = models.TextField(blank=True)

    def __str__(self):
        return f"{self.user.username} - {self.first_name} {self.last_name}".strip()


class OTPStore(models.Model):
    phone_number = models.CharField(max_length=15)
    otp = models.CharField(max_length=6)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.phone_number} - OTP: {self.otp}"