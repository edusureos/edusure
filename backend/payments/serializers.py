from decimal import Decimal
from rest_framework import serializers
from .models import FeeStructure, PaymentTransaction, SchoolPaymentConfig, StudentFeeInvoice


class SchoolPaymentConfigSerializer(serializers.ModelSerializer):
    class Meta:
        model = SchoolPaymentConfig
        fields = [
            "school_id",
            "school_name",
            "enable_direct_upi",
            "upi_id",
            "upi_payee_name",
            "enable_gateway",
            "pass_gateway_fee_to_parent",
            "gateway_fee_percent",
            "updated_at",
        ]
        read_only_fields = ["school_id", "updated_at"]

    def validate(self, attrs):
        enable_upi = attrs.get(
            "enable_direct_upi",
            getattr(self.instance, "enable_direct_upi", True),
        )
        upi_id = attrs.get("upi_id", getattr(self.instance, "upi_id", "")).strip()
        if enable_upi and not upi_id:
            raise serializers.ValidationError(
                {"upi_id": "Please provide a valid school UPI ID (e.g. school@sbi) when Direct UPI is enabled."}
            )
        if upi_id and "@" not in upi_id:
            raise serializers.ValidationError({"upi_id": "Invalid UPI ID format. Must contain '@'."})
        return attrs


class FeeStructureSerializer(serializers.ModelSerializer):
    class Meta:
        model = FeeStructure
        fields = [
            "id",
            "title",
            "description",
            "class_grade",
            "amount",
            "late_fee",
            "due_date",
            "academic_year",
            "is_active",
            "created_at",
        ]
        read_only_fields = ["id", "created_at"]


class AssignFeeInvoicesSerializer(serializers.Serializer):
    fee_structure_id = serializers.IntegerField()
    class_grade = serializers.CharField(required=False, allow_blank=True, default="")
    section = serializers.CharField(required=False, allow_blank=True, default="")
    student_ids = serializers.ListField(
        child=serializers.CharField(),
        required=False,
        default=list,
        help_text="Optional list of 10-digit student usernames. If empty, assigns to matching class_grade.",
    )
    discount_amount = serializers.DecimalField(
        max_digits=10, decimal_places=2, required=False, default=Decimal("0.00")
    )


class StudentFeeInvoiceSerializer(serializers.ModelSerializer):
    student_id = serializers.CharField(source="student.username", read_only=True)
    student_name = serializers.SerializerMethodField()
    class_grade = serializers.SerializerMethodField()
    section = serializers.SerializerMethodField()
    balance_due = serializers.DecimalField(max_digits=10, decimal_places=2, read_only=True)

    class Meta:
        model = StudentFeeInvoice
        fields = [
            "id",
            "invoice_number",
            "student_id",
            "student_name",
            "class_grade",
            "section",
            "title",
            "base_amount",
            "discount_amount",
            "late_fee_amount",
            "total_amount",
            "amount_paid",
            "balance_due",
            "due_date",
            "status",
            "created_at",
        ]

    def get_student_name(self, obj):
        sp = getattr(obj.student, "student_profile", None)
        if sp:
            return f"{sp.first_name} {sp.last_name}".strip()
        return obj.student.username

    def get_class_grade(self, obj):
        sp = getattr(obj.student, "student_profile", None)
        return sp.class_grade if sp else ""

    def get_section(self, obj):
        sp = getattr(obj.student, "student_profile", None)
        return sp.section if sp else ""


class PaymentTransactionSerializer(serializers.ModelSerializer):
    invoice_number = serializers.CharField(source="invoice.invoice_number", read_only=True)
    invoice_title = serializers.CharField(source="invoice.title", read_only=True)
    student_id = serializers.CharField(source="student.username", read_only=True)
    student_name = serializers.SerializerMethodField()
    verified_by = serializers.CharField(source="verified_by.username", read_only=True)

    class Meta:
        model = PaymentTransaction
        fields = [
            "id",
            "receipt_number",
            "invoice_number",
            "invoice_title",
            "student_id",
            "student_name",
            "amount",
            "convenience_fee",
            "total_charged",
            "payment_mode",
            "status",
            "utr_number",
            "payer_upi_id",
            "gateway_order_id",
            "gateway_payment_id",
            "remarks",
            "verified_by",
            "paid_at",
            "created_at",
        ]

    def get_student_name(self, obj):
        sp = getattr(obj.student, "student_profile", None)
        if sp:
            return f"{sp.first_name} {sp.last_name}".strip()
        return obj.student.username


class InitiateDirectUPISerializer(serializers.Serializer):
    invoice_id = serializers.IntegerField()
    amount = serializers.DecimalField(
        max_digits=10,
        decimal_places=2,
        required=False,
        help_text="Defaults to full remaining balance_due if omitted.",
    )


class SubmitUPIUTRSerializer(serializers.Serializer):
    invoice_id = serializers.IntegerField()
    utr_number = serializers.CharField(
        max_length=50,
        help_text="12-digit UPI UTR / Bank Reference Number from PhonePe, Paytm, GPay, etc.",
    )
    amount = serializers.DecimalField(max_digits=10, decimal_places=2, required=False)
    payer_upi_id = serializers.CharField(max_length=100, required=False, allow_blank=True, default="")
    remarks = serializers.CharField(max_length=255, required=False, allow_blank=True, default="")

    def validate_utr_number(self, value):
        cleaned = value.strip().upper().replace(" ", "")
        if len(cleaned) < 8 or not cleaned.isalnum():
            raise serializers.ValidationError("Enter a valid alphanumeric 12-digit UTR / Reference number.")
        duplicate = PaymentTransaction.objects.filter(
            utr_number=cleaned,
            status__in=[
                PaymentTransaction.Status.PENDING_VERIFICATION,
                PaymentTransaction.Status.SUCCESS,
            ],
        ).exists()
        if duplicate:
            raise serializers.ValidationError("This UTR / Reference number has already been submitted.")
        return cleaned


class VerifyUTRSerializer(serializers.Serializer):
    action = serializers.ChoiceField(choices=["APPROVE", "REJECT"])
    remarks = serializers.CharField(max_length=255, required=False, allow_blank=True, default="")


class CollectOfflinePaymentSerializer(serializers.Serializer):
    invoice_id = serializers.IntegerField()
    amount = serializers.DecimalField(max_digits=10, decimal_places=2)
    payment_mode = serializers.ChoiceField(
        choices=[
            PaymentTransaction.Mode.CASH,
            PaymentTransaction.Mode.DIRECT_UPI,
            PaymentTransaction.Mode.CHEQUE,
            PaymentTransaction.Mode.BANK_TRANSFER,
        ],
        default=PaymentTransaction.Mode.CASH,
    )
    utr_number = serializers.CharField(max_length=50, required=False, allow_blank=True, default="")
    remarks = serializers.CharField(max_length=255, required=False, allow_blank=True, default="")


class CreateGatewayOrderSerializer(serializers.Serializer):
    invoice_id = serializers.IntegerField()
    amount = serializers.DecimalField(max_digits=10, decimal_places=2, required=False)


class VerifyGatewayPaymentSerializer(serializers.Serializer):
    gateway_order_id = serializers.CharField()
    gateway_payment_id = serializers.CharField()
    gateway_signature = serializers.CharField(required=False, allow_blank=True, default="MOCK_SIGNATURE")