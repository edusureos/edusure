import datetime
import uuid
from decimal import Decimal
from django.conf import settings
from django.db import models


class SchoolPaymentConfig(models.Model):
    """Per-school payment settings: Direct UPI (0% fee) & optional Gateway settings."""
    school_id = models.IntegerField(unique=True, db_index=True)
    school_name = models.CharField(max_length=150, default="EduSure School")

    # 0% Commission Direct UPI Settings
    enable_direct_upi = models.BooleanField(default=True)
    upi_id = models.CharField(
        max_length=100,
        blank=True,
        help_text="School's official UPI ID (e.g. schoolname@sbi or 9876543210@ybl)",
    )
    upi_payee_name = models.CharField(max_length=100, blank=True)

    # Optional Payment Gateway Settings (Razorpay / PhonePe / Paytm)
    enable_gateway = models.BooleanField(default=False)
    pass_gateway_fee_to_parent = models.BooleanField(
        default=False,
        help_text="If True, adds convenience fee on top of invoice amount during gateway checkout.",
    )
    gateway_fee_percent = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        default=Decimal("2.36"),
    )
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"School {self.school_id} Payment Config ({self.upi_id or 'No UPI set'})"


class FeeStructure(models.Model):
    """Reusable fee template for a class or entire school (e.g. Term 1 Tuition Fee)."""
    school_id = models.IntegerField(db_index=True)
    title = models.CharField(max_length=150)
    description = models.TextField(blank=True)
    class_grade = models.CharField(
        max_length=20,
        blank=True,
        help_text="Leave blank to apply to all classes, or specify e.g. '10'",
    )
    amount = models.DecimalField(max_digits=10, decimal_places=2)
    late_fee = models.DecimalField(max_digits=10, decimal_places=2, default=Decimal("0.00"))
    due_date = models.DateField()
    academic_year = models.CharField(max_length=20, default="2026-27")
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        cls_label = f"Class {self.class_grade}" if self.class_grade else "All Classes"
        return f"[{self.school_id}] {self.title} ({cls_label}) - INR {self.amount}"


class StudentFeeInvoice(models.Model):
    """Individual fee bill assigned to a student."""
    class Status(models.TextChoices):
        PENDING = "PENDING", "Pending"
        PARTIAL = "PARTIAL", "Partially Paid"
        VERIFICATION_PENDING = "VERIFICATION_PENDING", "UTR Verification Pending"
        PAID = "PAID", "Paid"
        WAIVED = "WAIVED", "Waived"

    invoice_number = models.CharField(max_length=32, unique=True, editable=False)
    school_id = models.IntegerField(db_index=True)
    student = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="fee_invoices",
    )
    fee_structure = models.ForeignKey(
        FeeStructure,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="invoices",
    )
    title = models.CharField(max_length=150)
    base_amount = models.DecimalField(max_digits=10, decimal_places=2)
    discount_amount = models.DecimalField(max_digits=10, decimal_places=2, default=Decimal("0.00"))
    late_fee_amount = models.DecimalField(max_digits=10, decimal_places=2, default=Decimal("0.00"))
    total_amount = models.DecimalField(max_digits=10, decimal_places=2)
    amount_paid = models.DecimalField(max_digits=10, decimal_places=2, default=Decimal("0.00"))
    due_date = models.DateField()
    status = models.CharField(max_length=25, choices=Status.choices, default=Status.PENDING)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["school_id", "status"]),
            models.Index(fields=["student", "status"]),
        ]

    @property
    def balance_due(self):
        remaining = self.total_amount - self.amount_paid
        return remaining if remaining > Decimal("0.00") else Decimal("0.00")

    def save(self, *args, **kwargs):
        if not self.invoice_number:
            yr = datetime.date.today().strftime("%y")
            token = uuid.uuid4().hex[:6].upper()
            self.invoice_number = f"INV-{self.school_id}-{yr}-{token}"
        self.total_amount = max(
            Decimal("0.00"),
            (self.base_amount - self.discount_amount + self.late_fee_amount),
        )
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.invoice_number} | {self.student.username} | {self.status}"


class PaymentTransaction(models.Model):
    """Tracks Direct UPI (UTR), Gateway, and Offline Counter payments."""
    class Mode(models.TextChoices):
        DIRECT_UPI = "DIRECT_UPI", "Direct UPI (0% Fee)"
        GATEWAY = "GATEWAY", "Online Gateway"
        CASH = "CASH", "Cash Counter"
        CHEQUE = "CHEQUE", "Cheque"
        BANK_TRANSFER = "BANK_TRANSFER", "NEFT / IMPS / Bank Transfer"

    class Status(models.TextChoices):
        INITIATED = "INITIATED", "Initiated"
        PENDING_VERIFICATION = "PENDING_VERIFICATION", "Pending Admin Verification"
        SUCCESS = "SUCCESS", "Success"
        REJECTED = "REJECTED", "Rejected"
        FAILED = "FAILED", "Failed"

    receipt_number = models.CharField(max_length=32, unique=True, null=True, blank=True)
    school_id = models.IntegerField(db_index=True)
    invoice = models.ForeignKey(
        StudentFeeInvoice,
        on_delete=models.CASCADE,
        related_name="transactions",
    )
    student = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="payment_transactions",
    )
    amount = models.DecimalField(max_digits=10, decimal_places=2, help_text="Fee principal paid")
    convenience_fee = models.DecimalField(max_digits=10, decimal_places=2, default=Decimal("0.00"))
    total_charged = models.DecimalField(max_digits=10, decimal_places=2)

    payment_mode = models.CharField(max_length=20, choices=Mode.choices, default=Mode.DIRECT_UPI)
    status = models.CharField(max_length=25, choices=Status.choices, default=Status.INITIATED)

    # Direct UPI / Bank Reference Fields
    utr_number = models.CharField(max_length=50, blank=True, db_index=True)
    payer_upi_id = models.CharField(max_length=100, blank=True)

    # Optional Gateway Fields
    gateway_order_id = models.CharField(max_length=100, blank=True, db_index=True)
    gateway_payment_id = models.CharField(max_length=100, blank=True)
    gateway_signature = models.CharField(max_length=255, blank=True)

    remarks = models.CharField(max_length=255, blank=True)
    verified_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="verified_payments",
    )
    paid_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["school_id", "status"]),
            models.Index(fields=["utr_number"]),
        ]

    def assign_receipt_number(self):
        if not self.receipt_number:
            yr = datetime.date.today().strftime("%y")
            token = uuid.uuid4().hex[:6].upper()
            self.receipt_number = f"RCP-{self.school_id}-{yr}-{token}"

    def save(self, *args, **kwargs):
        if not self.total_charged:
            self.total_charged = self.amount + self.convenience_fee
        if self.status == self.Status.SUCCESS and not self.receipt_number:
            self.assign_receipt_number()
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.receipt_number or self.id} | {self.student.username} | {self.payment_mode} | {self.status}"


class ClassFeeStructure(models.Model):
    """Fee structure of a registered class: an ordered list of fee categories."""

    school_id = models.IntegerField(db_index=True)
    class_grade = models.CharField(max_length=20)
    section = models.CharField(max_length=5, blank=True, default="")
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["class_grade", "section"]
        unique_together = [("school_id", "class_grade", "section")]

    def __str__(self):
        label = f"Class {self.class_grade}"
        if self.section:
            label += f" · {self.section}"
        return f"[{self.school_id}] {label}"


class ClassFeeCategory(models.Model):
    """One fee category within a class fee structure.

    Connected to the FeeType list: ``fee_type_id``/``fee_type_title`` identify
    the fee type this category uses, and ``amount`` is the fee amount for that
    category in the class.
    """

    structure = models.ForeignKey(
        ClassFeeStructure, on_delete=models.CASCADE, related_name="categories"
    )
    fee_type_id = models.IntegerField()
    fee_type_title = models.CharField(max_length=150)
    amount = models.DecimalField(
        max_digits=10, decimal_places=2, default=Decimal("0.00")
    )
    position = models.IntegerField(default=0)
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ["position", "id"]

    def __str__(self):
        return f"{self.fee_type_title} — {self.amount}"