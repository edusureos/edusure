from django.urls import path
from .views import (
    AdminAssignFeeInvoicesView,
    AdminClassFeeStructureDetailView,
    AdminClassFeeStructureListCreateView,
    AdminCollectOfflinePaymentView,
    AdminFeeStructureListCreateView,
    AdminFeeSummaryView,
    AdminInvoiceDetailView,
    AdminInvoiceListView,
    AdminPaymentConfigView,
    AdminTransactionListView,
    AdminVerifyUTRView,
    CreateGatewayOrderView,
    FeeReceiptPDFView,
    InitiateDirectUPIPaymentView,
    StudentMyFeesView,
    SubmitUPIUTRView,
    VerifyGatewayPaymentView,
    RazorpayWebhookView,
)

urlpatterns = [
    # Admin Endpoints
    path("admin/config/", AdminPaymentConfigView.as_view(), name="admin-payment-config"),
    path("admin/summary/", AdminFeeSummaryView.as_view(), name="admin-fee-summary"),
    path("admin/fee-structures/", AdminFeeStructureListCreateView.as_view(), name="admin-fee-structures"),
    path("admin/class-fee-structures/", AdminClassFeeStructureListCreateView.as_view(), name="admin-class-fee-structures"),
    path("admin/class-fee-structures/<int:pk>/", AdminClassFeeStructureDetailView.as_view(), name="admin-class-fee-structure-detail"),
    path("admin/invoices/assign/", AdminAssignFeeInvoicesView.as_view(), name="admin-assign-invoices"),
    path("admin/invoices/", AdminInvoiceListView.as_view(), name="admin-invoices"),
    path("admin/invoices/<int:invoice_id>/", AdminInvoiceDetailView.as_view(), name="admin-invoice-detail"),
    path("admin/invoices/<int:invoice_id>/save-as-default/", AdminInvoiceDetailView.as_view(), name="admin-invoice-save-as-default"),
    path("admin/transactions/", AdminTransactionListView.as_view(), name="admin-transactions"),
    path("admin/verify-utr/<int:txn_id>/", AdminVerifyUTRView.as_view(), name="admin-verify-utr"),
    path("admin/collect-offline/", AdminCollectOfflinePaymentView.as_view(), name="admin-collect-offline"),

    # Student / Parent Endpoints (0% Fee Direct UPI + Optional Gateway)
    path("my-fees/", StudentMyFeesView.as_view(), name="student-my-fees"),
    path("upi/initiate/", InitiateDirectUPIPaymentView.as_view(), name="upi-initiate"),
    path("upi/submit-utr/", SubmitUPIUTRView.as_view(), name="upi-submit-utr"),
    path("gateway/create-order/", CreateGatewayOrderView.as_view(), name="gateway-create-order"),
    path("gateway/verify/", VerifyGatewayPaymentView.as_view(), name="gateway-verify"),
    path("gateway/create-order/", CreateGatewayOrderView.as_view(), name="gateway-create-order"),
    path("gateway/webhook/", RazorpayWebhookView.as_view(), name="gateway-webhook"),

    # Shared Official PDF Receipt
    path("receipt/<str:receipt_number>/pdf/", FeeReceiptPDFView.as_view(), name="fee-receipt-pdf"),
]