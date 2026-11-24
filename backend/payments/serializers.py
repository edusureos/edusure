import calendar
from decimal import Decimal
from django.db.models import Sum
from django.db import transaction
from rest_framework import serializers
from .models import (
    ClassFeeCategory,
    ClassFeeStructure,
    FeeStructure,
    PaymentTransaction,
    SchoolPaymentConfig,
    StudentFeeInvoice,
)


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
            "schedule_start_month",
            "schedule_end_month",
            "period_type",
            "penalty_period",
            "due_day",
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
    registered_phone = serializers.SerializerMethodField()
    admission_number = serializers.SerializerMethodField()
    roll_number = serializers.SerializerMethodField()
    father_name = serializers.SerializerMethodField()
    payment_count = serializers.SerializerMethodField()
    fee_structure_id = serializers.IntegerField(read_only=True, allow_null=True)
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
            "registered_phone",
            "admission_number",
            "roll_number",
            "father_name",
            "title",
            "base_amount",
            "discount_amount",
            "late_fee_amount",
            "total_amount",
            "amount_paid",
            "balance_due",
            "due_date",
            "schedule_start_month",
            "schedule_end_month",
            "period_type",
            "penalty_period",
            "due_day",
            "payment_count",
            "fee_structure_id",
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

    def get_registered_phone(self, obj):
        sp = getattr(obj.student, "student_profile", None)
        return (sp.registered_phone or obj.student.phone_number or "") if sp else (obj.student.phone_number or "")

    def get_admission_number(self, obj):
        sp = getattr(obj.student, "student_profile", None)
        return sp.admission_number if sp else ""

    def get_roll_number(self, obj):
        sp = getattr(obj.student, "student_profile", None)
        return sp.roll_number if sp else None

    def get_father_name(self, obj):
        sp = getattr(obj.student, "student_profile", None)
        return sp.father_name if sp else ""

    def get_payment_count(self, obj):
        if hasattr(obj, "_payment_count"):
            return obj._payment_count
        return obj.transactions.count()


class AdminStudentFeeInvoiceUpdateSerializer(serializers.ModelSerializer):
    late_penalty_enabled = serializers.BooleanField(required=False)

    class Meta:
        model = StudentFeeInvoice
        fields = [
            "base_amount",
            "schedule_start_month",
            "schedule_end_month",
            "period_type",
            "late_penalty_enabled",
            "late_fee_amount",
            "penalty_period",
            "due_day",
        ]
        extra_kwargs = {
            "base_amount": {"min_value": Decimal("0.01")},
            "late_fee_amount": {"min_value": Decimal("0.00")},
            "schedule_start_month": {"allow_null": True},
            "schedule_end_month": {"allow_null": True},
            "due_day": {"allow_null": True},
        }

    def validate(self, attrs):
        invoice = self.instance
        start = attrs.get("schedule_start_month", invoice.schedule_start_month)
        end = attrs.get("schedule_end_month", invoice.schedule_end_month)
        if start and end and start > end:
            raise serializers.ValidationError(
                {"schedule_end_month": "End month must be on or after the start month."}
            )

        base_amount = attrs.get("base_amount", invoice.base_amount)
        if base_amount != invoice.base_amount and invoice.transactions.exists():
            raise serializers.ValidationError(
                {"base_amount": "The amount cannot be changed after a payment has been recorded."}
            )

        late_penalty_enabled = attrs.pop(
            "late_penalty_enabled", invoice.late_fee_amount > Decimal("0.00")
        )
        if not late_penalty_enabled:
            attrs["late_fee_amount"] = Decimal("0.00")

        discount = invoice.discount_amount
        late_fee = attrs.get("late_fee_amount", invoice.late_fee_amount)
        pending_amount = invoice.transactions.filter(
            status=PaymentTransaction.Status.PENDING_VERIFICATION
        ).aggregate(total=Sum("amount"))["total"] or Decimal("0.00")
        if base_amount - discount + late_fee < invoice.amount_paid + pending_amount:
            raise serializers.ValidationError(
                {"late_fee_amount": "The updated fee cannot be less than payments already recorded or awaiting verification."}
            )
        return attrs

    def update(self, instance, validated_data):
        instance = super().update(instance, validated_data)
        if instance.schedule_start_month and instance.due_day:
            year = instance.schedule_start_month.year
            month = instance.schedule_start_month.month
            day = min(instance.due_day, calendar.monthrange(year, month)[1])
            instance.due_date = instance.schedule_start_month.replace(day=day)
            instance.save(update_fields=["due_date", "updated_at"])
        return instance

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


class ClassFeeCategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = ClassFeeCategory
        fields = ["id", "fee_type_id", "fee_type_title", "amount", "position", "is_active"]


class ClassFeeStructureSerializer(serializers.ModelSerializer):
    """A per-class fee structure: an ordered list of fee categories."""

    categories = ClassFeeCategorySerializer(many=True, required=False, default=list)

    class Meta:
        model = ClassFeeStructure
        fields = [
            "id",
            "class_grade",
            "section",
            "is_active",
            "created_at",
            "updated_at",
            "categories",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]

    @transaction.atomic
    def create(self, validated_data):
        categories = validated_data.pop("categories", [])
        structure = ClassFeeStructure.objects.create(
            school_id=self.context["school_id"], **validated_data
        )
        self._replace_categories(structure, categories)
        return structure

    @transaction.atomic
    def update(self, instance, validated_data):
        categories = validated_data.pop("categories", None)
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()
        if categories is not None:
            self._replace_categories(instance, categories)
        return instance

    @staticmethod
    def _replace_categories(structure, categories):
        structure.categories.all().delete()
        for position, category in enumerate(categories):
            category.pop("id", None)
            category.setdefault("position", position)
            ClassFeeCategory.objects.create(structure=structure, **category)