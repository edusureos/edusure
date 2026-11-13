from django.contrib import admin
from .models import User, StudentProfile, TeacherProfile, Notice, OTPStore

@admin.register(User)
class UserAdmin(admin.ModelAdmin):
    list_display = ('username', 'phone_number', 'role', 'school_id', 'is_staff')
    search_fields = ('username', 'phone_number')
    list_filter = ('role', 'is_staff')

@admin.register(StudentProfile)
class StudentProfileAdmin(admin.ModelAdmin):
    list_display = ('user', 'admission_number', 'first_name', 'last_name', 'class_grade', 'section', 'roll_number')
    search_fields = ('user__username', 'first_name', 'last_name', 'admission_number')

@admin.register(TeacherProfile)
class TeacherProfileAdmin(admin.ModelAdmin):
    list_display = ('user', 'employee_id', 'first_name', 'last_name', 'subject', 'class_teacher_of')
    search_fields = ('user__username', 'first_name', 'last_name', 'employee_id')

@admin.register(Notice)
class NoticeAdmin(admin.ModelAdmin):
    list_display = ('title', 'school_id', 'target_role', 'target_class', 'created_at')
    list_filter = ('school_id', 'target_role')

@admin.register(OTPStore)
class OTPStoreAdmin(admin.ModelAdmin):
    list_display = ('phone_number', 'otp', 'created_at')