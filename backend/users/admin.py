from django.contrib import admin
from .models import User, StudentProfile, OTPStore

@admin.register(User)
class UserAdmin(admin.ModelAdmin):
    list_display = ('username', 'phone_number', 'role', 'school_id', 'is_staff')
    search_fields = ('username', 'phone_number')
    list_filter = ('role', 'is_staff')

@admin.register(StudentProfile)
class StudentProfileAdmin(admin.ModelAdmin):
    list_display = ('user', 'admission_number', 'first_name', 'last_name', 'class_grade', 'section', 'roll_number')
    search_fields = ('user__username', 'first_name', 'last_name', 'admission_number')

@admin.register(OTPStore)
class OTPStoreAdmin(admin.ModelAdmin):
    list_display = ('phone_number', 'otp', 'created_at')
    