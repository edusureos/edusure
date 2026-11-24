import base64
import io
import urllib.parse
import uuid
from decimal import Decimal, ROUND_HALF_UP

from django.conf import settings
from django.contrib.auth import get_user_model
from django.db import transaction
from django.db.models import Count, Q, Sum
from django.http import FileResponse
from django.shortcuts import get_object_or_404
from django.utils import timezone
from drf_spectacular.utils import extend_schema
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from users.models import StudentProfile
from users.permissions import IsSchoolAdmin

from .models import (
    ClassFeeStructure,
    FeeStructure,
    PaymentTransaction,
    SchoolPaymentConfig,
    StudentFeeInvoice,
)
from .receipt_utils import generate_fee_receipt_pdf
from .serializers import (
    AssignFeeInvoicesSerializer,
    ClassFeeStructureSerializer,
    CollectOfflinePaymentSerializer,
    CreateGatewayOrderSerializer,
    FeeStructureSerializer,
    InitiateDirectUPISerializer,
    PaymentTransactionSerializer,
    SchoolPaymentConfigSerializer,
    StudentFeeInvoiceSerializer,
    SubmitUPIUTRSerializer,
    VerifyGatewayPaymentSerializer,
    VerifyUTRSerializer,
)

User = get_user_model()


def _get_or_create_school_config(school_id):
    config, _ = SchoolPaymentConfig.objects.get_or_create(
        school_id=school_id,
        defaults={
            "school_name": f"EduSure School ({school_id})",
            "upi_payee_name": f"EduSure School {school_id}",
        },
    )
    return config


def _build_upi_links(upi_id, payee_name, amount, note):
    params = {
        "pa": upi_id.strip(),
        "pn": (payee_name or "School Fees").strip(),
        "am": f"{Decimal(amount):.2f}",
        "cu": "INR",
        "tn": note.strip(),
    }
    query = urllib.parse.urlencode(params, quote_via=urllib.parse.quote)
    upi_uri = f"upi://pay?{query}"

    qr_base64 = None
    try:
        import qrcode

        img = qrcode.make(upi_uri)
        buf = io.BytesIO()
        img.save(buf, format="PNG")
        qr_base64 = f"data:image/png;base64,{base64.b64encode(buf.getvalue()).decode('ascii')}"
    except Exception:
        qr_base64 = None

    return {
        "upi_uri": upi_uri,
        "phonepe_uri": f"phonepe://pay?{query}",
        "gpay_uri": f"tez://upi/pay?{query}",
        "paytm_uri": f"paytmmp://pay?{query}",
        "qr_image_base64": qr_base64,
    }


def _recalculate_invoice_status(invoice):
    if invoice.amount_paid >= invoice.total_amount:
        invoice.status = StudentFeeInvoice.Status.PAID
    elif invoice.transactions.filter(status=PaymentTransaction.Status.PENDING_VERIFICATION).exists():
        invoice.status = StudentFeeInvoice.Status.VERIFICATION_PENDING
    elif invoice.amount_paid > Decimal("0.00"):
        invoice.status = StudentFeeInvoice.Status.PARTIAL
    else:
        invoice.status = StudentFeeInvoice.Status.PENDING
    invoice.save(update_fields=["amount_paid", "status", "updated_at"])


# ==============================================================================
# ADMIN ENDPOINTS
# ==============================================================================


class AdminPaymentConfigView(APIView):
    """Configure School's 0%-fee Direct UPI ID & optional Gateway toggles."""
    permission_classes = [IsAuthenticated, IsSchoolAdmin]

    @extend_schema(summary="Get school payment configuration", responses={200: SchoolPaymentConfigSerializer})
    def get(self, request):
        config = _get_or_create_school_config(request.user.school_id)
        return Response(SchoolPaymentConfigSerializer(config).data, status=status.HTTP_200_OK)

    @extend_schema(
        summary="Update school UPI ID & payment gateway settings",
        request=SchoolPaymentConfigSerializer,
        responses={200: SchoolPaymentConfigSerializer},
    )
    def put(self, request):
        config = _get_or_create_school_config(request.user.school_id)
        serializer = SchoolPaymentConfigSerializer(config, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data, status=status.HTTP_200_OK)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class AdminFeeStructureListCreateView(APIView):
    permission_classes = [IsAuthenticated, IsSchoolAdmin]

    @extend_schema(summary="List school fee structures", responses={200: FeeStructureSerializer(many=True)})
    def get(self, request):
        qs = FeeStructure.objects.filter(school_id=request.user.school_id)
        return Response(FeeStructureSerializer(qs, many=True).data, status=status.HTTP_200_OK)

    @extend_schema(
        summary="Create a new fee structure",
        request=FeeStructureSerializer,
        responses={201: FeeStructureSerializer},
    )
    def post(self, request):
        serializer = FeeStructureSerializer(data=request.data)
        if serializer.is_valid():
            serializer.save(school_id=request.user.school_id)
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class AdminAssignFeeInvoicesView(APIView):
    """Bulk-assign a FeeStructure to a class, section, or selected students."""
    permission_classes = [IsAuthenticated, IsSchoolAdmin]

    @extend_schema(summary="Assign fee invoices to students", request=AssignFeeInvoicesSerializer)
    @transaction.atomic
    def post(self, request):
        serializer = AssignFeeInvoicesSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        school_id = request.user.school_id
        data = serializer.validated_data
        fee_structure = get_object_or_404(
            FeeStructure, id=data["fee_structure_id"], school_id=school_id
        )

        students_qs = StudentProfile.objects.select_related("user").filter(
            user__school_id=school_id, user__is_active=True
        )

        target_class = (data.get("class_grade") or fee_structure.class_grade or "").strip()
        target_section = (data.get("section") or "").strip()
        student_ids = data.get("student_ids") or []

        if student_ids:
            students_qs = students_qs.filter(user__username__in=student_ids)
        else:
            if target_class:
                students_qs = students_qs.filter(class_grade=target_class)
            if target_section:
                students_qs = students_qs.filter(section=target_section)

        existing_student_ids = set(
            StudentFeeInvoice.objects.filter(
                school_id=school_id, fee_structure=fee_structure
            ).values_list("student_id", flat=True)
        )

        created_count = 0
        discount = data.get("discount_amount", Decimal("0.00"))
        for sp in students_qs:
            if sp.user_id in existing_student_ids:
                continue
            StudentFeeInvoice.objects.create(
                school_id=school_id,
                student=sp.user,
                fee_structure=fee_structure,
                title=fee_structure.title,
                base_amount=fee_structure.amount,
                discount_amount=discount,
                late_fee_amount=fee_structure.late_fee,
                due_date=fee_structure.due_date,
            )
            created_count += 1

        return Response(
            {
                "detail": f"Assigned '{fee_structure.title}' to {created_count} students.",
                "invoices_created": created_count,
            },
            status=status.HTTP_201_CREATED,
        )


class AdminInvoiceListView(APIView):
    permission_classes = [IsAuthenticated, IsSchoolAdmin]

    @extend_schema(summary="List student fee invoices", responses={200: StudentFeeInvoiceSerializer(many=True)})
    def get(self, request):
        qs = StudentFeeInvoice.objects.select_related(
            "student", "student__student_profile"
        ).filter(school_id=request.user.school_id)

        inv_status = request.query_params.get("status")
        class_grade = request.query_params.get("class_grade")
        search = request.query_params.get("search")

        if inv_status:
            qs = qs.filter(status=inv_status)
        if class_grade:
            qs = qs.filter(student__student_profile__class_grade=class_grade)
        if search:
            qs = qs.filter(
                Q(invoice_number__icontains=search)
                | Q(student__username__icontains=search)
                | Q(student__student_profile__first_name__icontains=search)
            )

        return Response(StudentFeeInvoiceSerializer(qs[:200], many=True).data, status=status.HTTP_200_OK)


class AdminTransactionListView(APIView):
    """View all fee transactions, including pending UPI UTR verifications."""
    permission_classes = [IsAuthenticated, IsSchoolAdmin]

    @extend_schema(summary="List payment transactions & pending UTRs", responses={200: PaymentTransactionSerializer(many=True)})
    def get(self, request):
        qs = PaymentTransaction.objects.select_related(
            "invoice", "student", "student__student_profile", "verified_by"
        ).filter(school_id=request.user.school_id)

        txn_status = request.query_params.get("status")
        mode = request.query_params.get("payment_mode")
        if txn_status:
            qs = qs.filter(status=txn_status)
        if mode:
            qs = qs.filter(payment_mode=mode)

        return Response(PaymentTransactionSerializer(qs[:200], many=True).data, status=status.HTTP_200_OK)


class AdminVerifyUTRView(APIView):
    """1-click Approve or Reject a student's submitted 12-digit UPI UTR."""
    permission_classes = [IsAuthenticated, IsSchoolAdmin]

    @extend_schema(summary="Approve or reject a submitted UPI UTR", request=VerifyUTRSerializer)
    @transaction.atomic
    def post(self, request, txn_id):
        serializer = VerifyUTRSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        txn = get_object_or_404(
            PaymentTransaction.objects.select_for_update(),
            id=txn_id,
            school_id=request.user.school_id,
        )
        if txn.status != PaymentTransaction.Status.PENDING_VERIFICATION:
            return Response(
                {"detail": f"Cannot verify transaction in '{txn.status}' state."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        action = serializer.validated_data["action"]
        remarks = serializer.validated_data.get("remarks", "")
        invoice = txn.invoice

        if action == "APPROVE":
            txn.status = PaymentTransaction.Status.SUCCESS
            txn.verified_by = request.user
            txn.paid_at = timezone.now()
            if remarks:
                txn.remarks = remarks
            txn.assign_receipt_number()
            txn.save()

            invoice.amount_paid = invoice.amount_paid + txn.amount
            _recalculate_invoice_status(invoice)

            return Response(
                {
                    "detail": f"UTR verified. Receipt {txn.receipt_number} generated.",
                    "transaction": PaymentTransactionSerializer(txn).data,
                },
                status=status.HTTP_200_OK,
            )

        # REJECT
        txn.status = PaymentTransaction.Status.REJECTED
        txn.verified_by = request.user
        txn.remarks = remarks or "UTR did not match bank statement."
        txn.save()
        _recalculate_invoice_status(invoice)

        return Response(
            {
                "detail": "UTR submission rejected. Student has been notified to resubmit.",
                "transaction": PaymentTransactionSerializer(txn).data,
            },
            status=status.HTTP_200_OK,
        )


class AdminCollectOfflinePaymentView(APIView):
    """Collect Cash / Counter UPI / Cheque directly at school office."""
    permission_classes = [IsAuthenticated, IsSchoolAdmin]

    @extend_schema(summary="Record offline/counter fee payment & issue receipt", request=CollectOfflinePaymentSerializer)
    @transaction.atomic
    def post(self, request):
        serializer = CollectOfflinePaymentSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        data = serializer.validated_data
        invoice = get_object_or_404(
            StudentFeeInvoice.objects.select_for_update(),
            id=data["invoice_id"],
            school_id=request.user.school_id,
        )

        amount = data["amount"]
        if amount <= Decimal("0.00") or amount > invoice.balance_due:
            return Response(
                {"detail": f"Amount must be between 0.01 and remaining balance ({invoice.balance_due})."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        txn = PaymentTransaction.objects.create(
            school_id=request.user.school_id,
            invoice=invoice,
            student=invoice.student,
            amount=amount,
            convenience_fee=Decimal("0.00"),
            total_charged=amount,
            payment_mode=data["payment_mode"],
            status=PaymentTransaction.Status.SUCCESS,
            utr_number=data.get("utr_number", ""),
            remarks=data.get("remarks", "Collected at school counter"),
            verified_by=request.user,
            paid_at=timezone.now(),
        )

        invoice.amount_paid = invoice.amount_paid + amount
        _recalculate_invoice_status(invoice)

        return Response(
            {
                "detail": f"Payment recorded. Receipt {txn.receipt_number} issued.",
                "transaction": PaymentTransactionSerializer(txn).data,
            },
            status=status.HTTP_201_CREATED,
        )


class AdminFeeSummaryView(APIView):
    """Admin financial dashboard KPIs (Total Billed, Collected, Pending UTRs, Mode split)."""
    permission_classes = [IsAuthenticated, IsSchoolAdmin]

    @extend_schema(summary="Get school fee collection summary")
    def get(self, request):
        school_id = request.user.school_id
        invoices_qs = StudentFeeInvoice.objects.filter(school_id=school_id)
        agg = invoices_qs.aggregate(
            total_billed=Sum("total_amount"),
            total_collected=Sum("amount_paid"),
        )
        total_billed = agg["total_billed"] or Decimal("0.00")
        total_collected = agg["total_collected"] or Decimal("0.00")
        total_pending = max(Decimal("0.00"), total_billed - total_collected)

        pending_utrs = PaymentTransaction.objects.filter(
            school_id=school_id,
            status=PaymentTransaction.Status.PENDING_VERIFICATION,
        ).count()

        mode_breakdown = list(
            PaymentTransaction.objects.filter(
                school_id=school_id, status=PaymentTransaction.Status.SUCCESS
            )
            .values("payment_mode")
            .annotate(total=Sum("amount"), count=Count("id"))
        )

        return Response(
            {
                "school_id": school_id,
                "total_billed": str(total_billed),
                "total_collected": str(total_collected),
                "total_pending": str(total_pending),
                "pending_utr_verifications": pending_utrs,
                "collection_by_mode": mode_breakdown,
            },
            status=status.HTTP_200_OK,
        )


# ==============================================================================
# STUDENT / PARENT ENDPOINTS
# ==============================================================================


class StudentMyFeesView(APIView):
    """Student/Parent view of assigned invoices, transactions, and available payment modes."""
    permission_classes = [IsAuthenticated]

    @extend_schema(summary="Get logged-in student's fee invoices & payment options")
    def get(self, request):
        user = request.user
        config = _get_or_create_school_config(user.school_id or 101)
        invoices = StudentFeeInvoice.objects.filter(student=user)
        transactions = PaymentTransaction.objects.filter(student=user)[:30]

        total_due = sum((inv.balance_due for inv in invoices), Decimal("0.00"))

        return Response(
            {
                "student_id": user.username,
                "total_balance_due": str(total_due),
                "payment_options": {
                    "direct_upi_enabled": bool(config.enable_direct_upi and config.upi_id),
                    "upi_id": config.upi_id if config.enable_direct_upi else "",
                    "upi_payee_name": config.upi_payee_name,
                    "gateway_enabled": config.enable_gateway,
                    "pass_gateway_fee_to_parent": config.pass_gateway_fee_to_parent,
                    "gateway_fee_percent": str(config.gateway_fee_percent),
                },
                "invoices": StudentFeeInvoiceSerializer(invoices, many=True).data,
                "transactions": PaymentTransactionSerializer(transactions, many=True).data,
            },
            status=status.HTTP_200_OK,
        )


class InitiateDirectUPIPaymentView(APIView):
    """Step 1 (0% Fee): Generate Dynamic UPI Intent Links & QR Code for an invoice."""
    permission_classes = [IsAuthenticated]

    @extend_schema(summary="Generate 0%-fee Dynamic UPI link & QR for invoice", request=InitiateDirectUPISerializer)
    def post(self, request):
        serializer = InitiateDirectUPISerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        invoice = get_object_or_404(
            StudentFeeInvoice, id=serializer.validated_data["invoice_id"], student=request.user
        )
        if invoice.balance_due <= Decimal("0.00"):
            return Response({"detail": "This invoice is already fully paid."}, status=status.HTTP_400_BAD_REQUEST)

        config = _get_or_create_school_config(invoice.school_id)
        if not config.enable_direct_upi or not config.upi_id:
            return Response(
                {"detail": "Direct UPI is not configured by your school yet."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        amount = serializer.validated_data.get("amount") or invoice.balance_due
        if amount <= Decimal("0.00") or amount > invoice.balance_due:
            return Response(
                {"detail": f"Amount must be between 0.01 and {invoice.balance_due}."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        links = _build_upi_links(
            upi_id=config.upi_id,
            payee_name=config.upi_payee_name or config.school_name,
            amount=amount,
            note=f"{invoice.invoice_number}-{request.user.username}",
        )

        return Response(
            {
                "invoice_number": invoice.invoice_number,
                "upi_id": config.upi_id,
                "payee_name": config.upi_payee_name or config.school_name,
                "amount": f"{amount:.2f}",
                "gateway_fee": "0.00",
                **links,
            },
            status=status.HTTP_200_OK,
        )


class SubmitUPIUTRView(APIView):
    """Step 2 (0% Fee): Parent submits 12-digit UTR after paying via PhonePe/Paytm/GPay."""
    permission_classes = [IsAuthenticated]

    @extend_schema(summary="Submit 12-digit UTR for verification", request=SubmitUPIUTRSerializer)
    @transaction.atomic
    def post(self, request):
        serializer = SubmitUPIUTRSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        data = serializer.validated_data
        invoice = get_object_or_404(
            StudentFeeInvoice.objects.select_for_update(),
            id=data["invoice_id"],
            student=request.user,
        )
        if invoice.balance_due <= Decimal("0.00"):
            return Response({"detail": "This invoice is already paid."}, status=status.HTTP_400_BAD_REQUEST)

        amount = data.get("amount") or invoice.balance_due
        if amount <= Decimal("0.00") or amount > invoice.balance_due:
            return Response(
                {"detail": f"Amount must be between 0.01 and {invoice.balance_due}."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        txn = PaymentTransaction.objects.create(
            school_id=invoice.school_id,
            invoice=invoice,
            student=request.user,
            amount=amount,
            convenience_fee=Decimal("0.00"),
            total_charged=amount,
            payment_mode=PaymentTransaction.Mode.DIRECT_UPI,
            status=PaymentTransaction.Status.PENDING_VERIFICATION,
            utr_number=data["utr_number"],
            payer_upi_id=data.get("payer_upi_id", ""),
            remarks=data.get("remarks", "Submitted via Student Portal"),
        )
        _recalculate_invoice_status(invoice)

        return Response(
            {
                "detail": "UTR submitted successfully. Official receipt will be generated once verified by the school office.",
                "transaction": PaymentTransactionSerializer(txn).data,
            },
            status=status.HTTP_201_CREATED,
        )


class CreateGatewayOrderView(APIView):
    """Optional Gateway Path (Razorpay / Sandbox Mock) with optional convenience fee pass-through."""
    permission_classes = [IsAuthenticated]

    @extend_schema(summary="Create online payment gateway order", request=CreateGatewayOrderSerializer)
    def post(self, request):
        serializer = CreateGatewayOrderSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        invoice = get_object_or_404(
            StudentFeeInvoice, id=serializer.validated_data["invoice_id"], student=request.user
        )
        config = _get_or_create_school_config(invoice.school_id)
        if not config.enable_gateway:
            return Response(
                {"detail": "Online gateway payments are disabled for this school. Please use Direct UPI."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        amount = serializer.validated_data.get("amount") or invoice.balance_due
        if amount <= Decimal("0.00") or amount > invoice.balance_due:
            return Response(
                {"detail": f"Amount must be between 0.01 and {invoice.balance_due}."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        conv_fee = Decimal("0.00")
        if config.pass_gateway_fee_to_parent and config.gateway_fee_percent > 0:
            conv_fee = ((amount * config.gateway_fee_percent) / Decimal("100")).quantize(
                Decimal("0.01"), rounding=ROUND_HALF_UP
            )

        total_charged = amount + conv_fee
        amount_paise = int(total_charged * 100)

        key_id = getattr(settings, "RAZORPAY_KEY_ID", "")
        key_secret = getattr(settings, "RAZORPAY_KEY_SECRET", "")
        mock_mode = True
        order_id = f"order_mock_{uuid.uuid4().hex[:12]}"

        if key_id and key_secret:
            try:
                import razorpay

                client = razorpay.Client(auth=(key_id, key_secret))
                rzp_order = client.order.create(
                    {
                        "amount": amount_paise,
                        "currency": "INR",
                        "receipt": invoice.invoice_number,
                    }
                )
                order_id = rzp_order["id"]
                mock_mode = False
            except Exception as e:
                return Response({"detail": f"Gateway error: {str(e)}"}, status=status.HTTP_502_BAD_GATEWAY)

        txn = PaymentTransaction.objects.create(
            school_id=invoice.school_id,
            invoice=invoice,
            student=request.user,
            amount=amount,
            convenience_fee=conv_fee,
            total_charged=total_charged,
            payment_mode=PaymentTransaction.Mode.GATEWAY,
            status=PaymentTransaction.Status.INITIATED,
            gateway_order_id=order_id,
        )

        return Response(
            {
                "mock_mode": mock_mode,
                "key_id": key_id or "rzp_test_mock",
                "order_id": order_id,
                "amount_paise": amount_paise,
                "currency": "INR",
                "fee_amount": f"{amount:.2f}",
                "convenience_fee": f"{conv_fee:.2f}",
                "total_charged": f"{total_charged:.2f}",
                "transaction_id": txn.id,
            },
            status=status.HTTP_201_CREATED,
        )


class VerifyGatewayPaymentView(APIView):
    """Verify Gateway callback signature & generate receipt."""
    permission_classes = [IsAuthenticated]

    @extend_schema(summary="Verify gateway payment & issue PDF receipt", request=VerifyGatewayPaymentSerializer)
    @transaction.atomic
    def post(self, request):
        serializer = VerifyGatewayPaymentSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        data = serializer.validated_data
        txn = get_object_or_404(
            PaymentTransaction.objects.select_for_update(),
            gateway_order_id=data["gateway_order_id"],
            student=request.user,
        )
        if txn.status == PaymentTransaction.Status.SUCCESS:
            return Response(
                {
                    "detail": "Payment already verified.",
                    "transaction": PaymentTransactionSerializer(txn).data,
                },
                status=status.HTTP_200_OK,
            )

        key_id = getattr(settings, "RAZORPAY_KEY_ID", "")
        key_secret = getattr(settings, "RAZORPAY_KEY_SECRET", "")
        if key_id and key_secret and not txn.gateway_order_id.startswith("order_mock_"):
            try:
                import razorpay

                client = razorpay.Client(auth=(key_id, key_secret))
                client.utility.verify_payment_signature(
                    {
                        "razorpay_order_id": data["gateway_order_id"],
                        "razorpay_payment_id": data["gateway_payment_id"],
                        "razorpay_signature": data["gateway_signature"],
                    }
                )
            except Exception:
                txn.status = PaymentTransaction.Status.FAILED
                txn.save(update_fields=["status"])
                return Response({"detail": "Gateway signature verification failed."}, status=status.HTTP_400_BAD_REQUEST)

        txn.gateway_payment_id = data["gateway_payment_id"]
        txn.gateway_signature = data.get("gateway_signature", "")
        txn.status = PaymentTransaction.Status.SUCCESS
        txn.paid_at = timezone.now()
        txn.assign_receipt_number()
        txn.save()

        invoice = txn.invoice
        invoice.amount_paid = invoice.amount_paid + txn.amount
        _recalculate_invoice_status(invoice)

        return Response(
            {
                "detail": f"Payment verified. Receipt {txn.receipt_number} generated.",
                "transaction": PaymentTransactionSerializer(txn).data,
            },
            status=status.HTTP_200_OK,
        )


class FeeReceiptPDFView(APIView):
    """Download official PDF fee receipt (accessible by owning student or school admin)."""
    permission_classes = [IsAuthenticated]

    @extend_schema(summary="Download official PDF fee receipt", responses={200: bytes})
    def get(self, request, receipt_number):
        user = request.user
        txn = get_object_or_404(
            PaymentTransaction.objects.select_related("invoice", "student", "student__student_profile", "verified_by"),
            receipt_number=receipt_number,
            status=PaymentTransaction.Status.SUCCESS,
        )

        is_admin = user.role in ["SCHOOL_ADMIN", "SUPER_ADMIN"] and user.school_id == txn.school_id
        is_owner = txn.student_id == user.id
        if not (is_admin or is_owner):
            return Response({"detail": "Not authorized to view this receipt."}, status=status.HTTP_403_FORBIDDEN)

        config = _get_or_create_school_config(txn.school_id)
        pdf_buffer = generate_fee_receipt_pdf(txn, school_name=config.school_name)

        return FileResponse(
            pdf_buffer,
            as_attachment=True,
            filename=f"{txn.receipt_number}.pdf",
            content_type="application/pdf",
        )


class AdminClassFeeStructureListCreateView(APIView):
    """List the school's per-class fee structures and create new ones."""

    permission_classes = [IsAuthenticated, IsSchoolAdmin]

    @extend_schema(summary="List class fee structures", responses={200: ClassFeeStructureSerializer(many=True)})
    def get(self, request):
        qs = ClassFeeStructure.objects.filter(
            school_id=request.user.school_id
        ).prefetch_related("categories")
        return Response(
            ClassFeeStructureSerializer(qs, many=True).data,
            status=status.HTTP_200_OK,
        )

    @extend_schema(
        summary="Create a class fee structure",
        request=ClassFeeStructureSerializer,
        responses={201: ClassFeeStructureSerializer},
    )
    def post(self, request):
        serializer = ClassFeeStructureSerializer(
            data=request.data, context={"school_id": request.user.school_id}
        )
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        structure = serializer.save()
        return Response(
            ClassFeeStructureSerializer(structure).data,
            status=status.HTTP_201_CREATED,
        )


class AdminClassFeeStructureDetailView(APIView):
    """View, update or remove a class fee structure."""

    permission_classes = [IsAuthenticated, IsSchoolAdmin]

    def get_object(self, request, pk):
        return get_object_or_404(
            ClassFeeStructure, id=pk, school_id=request.user.school_id
        )

    def get(self, request, pk):
        structure = self.get_object(request, pk)
        return Response(ClassFeeStructureSerializer(structure).data, status=status.HTTP_200_OK)

    def put(self, request, pk):
        structure = self.get_object(request, pk)
        serializer = ClassFeeStructureSerializer(structure, data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        updated = serializer.save()
        return Response(ClassFeeStructureSerializer(updated).data, status=status.HTTP_200_OK)

    def delete(self, request, pk):
        structure = self.get_object(request, pk)
        structure.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)