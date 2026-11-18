from django.contrib import admin
from .models import FeeStructure, PaymentTransaction, SchoolPaymentConfig, StudentFeeInvoice


@admin.register(SchoolPaymentConfig)
class SchoolPaymentConfigAdmin(admin.ModelAdmin):
    list_display = ("school_id", "school_name", "upi_id", "enable_direct_upi", "enable_gateway")


@admin.register(FeeStructure)
class FeeStructureAdmin(admin.ModelAdmin):
    list_display = ("title", "school_id", "class_grade", "amount", "due_date", "is_active")
    list_filter = ("school_id", "academic_year", "is_active")


@admin.register(StudentFeeInvoice)
class StudentFeeInvoiceAdmin(admin.ModelAdmin):
    list_display = ("invoice_number", "student", "title", "total_amount", "amount_paid", "status", "due_date")
    list_filter = ("school_id", "status")
    search_fields = ("invoice_number", "student__username")


@admin.register(PaymentTransaction)
class PaymentTransactionAdmin(admin.ModelAdmin):
    list_display = ("receipt_number", "student", "amount", "payment_mode", "status", "utr_number", "paid_at")
    list_filter = ("school_id", "payment_mode", "status")
    search_fields = ("receipt_number", "utr_number", "student__username")