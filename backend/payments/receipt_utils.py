import io
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle


def generate_fee_receipt_pdf(txn, school_name="EduSure School"):
    """Generates an official A4 PDF fee receipt in memory (BytesIO, zero disk lock)."""
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        leftMargin=36,
        rightMargin=36,
        topMargin=36,
        bottomMargin=36,
    )
    styles = getSampleStyleSheet()

    student = txn.student
    sp = getattr(student, "student_profile", None)
    student_name = f"{sp.first_name} {sp.last_name}".strip() if sp else student.username
    class_str = (
        f"{sp.class_grade} - {sp.section}"
        if (sp and sp.class_grade and sp.section)
        else (sp.class_grade if sp and sp.class_grade else "—")
    )
    father_name = sp.father_name if (sp and sp.father_name) else "—"
    paid_date = (txn.paid_at or txn.created_at).strftime("%d %b %Y, %I:%M %p")

    elements = [
        Paragraph(f"<b>{school_name}</b>", styles["Title"]),
        Paragraph(
            f"School Code: {txn.school_id} &nbsp;|&nbsp; Official Fee Payment Receipt",
            styles["Normal"],
        ),
        Spacer(1, 14),
    ]

    meta_data = [
        ["Receipt Number:", txn.receipt_number or "—", "Payment Date:", paid_date],
        ["Invoice Number:", txn.invoice.invoice_number, "Payment Mode:", txn.get_payment_mode_display()],
        ["Student Name:", student_name, "Student ID:", student.username],
        ["Class / Section:", class_str, "Guardian Name:", father_name],
    ]
    if txn.utr_number:
        meta_data.append(["UTR / Ref No.:", txn.utr_number, "Status:", "PAID & VERIFIED"])
    elif txn.gateway_payment_id:
        meta_data.append(["Gateway Ref:", txn.gateway_payment_id, "Status:", "PAID & VERIFIED"])
    else:
        meta_data.append(["Verified By:", txn.verified_by.username if txn.verified_by else "School Office", "Status:", "PAID"])

    meta_table = Table(meta_data, colWidths=[105, 160, 105, 150])
    meta_table.setStyle(
        TableStyle(
            [
                ("FONTNAME", (0, 0), (0, -1), "Helvetica-Bold"),
                ("FONTNAME", (2, 0), (2, -1), "Helvetica-Bold"),
                ("FONTSIZE", (0, 0), (-1, -1), 9),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
                ("TOPPADDING", (0, 0), (-1, -1), 6),
                ("LINEBELOW", (0, -1), (-1, -1), 1, colors.HexColor("#CBD5E1")),
            ]
        )
    )
    elements.append(meta_table)
    elements.append(Spacer(1, 16))

    fee_rows = [
        ["Particulars", "Amount (INR)"],
        [txn.invoice.title, f"INR {txn.amount:,.2f}"],
    ]
    if txn.convenience_fee > 0:
        fee_rows.append(["Payment Gateway Convenience Fee", f"INR {txn.convenience_fee:,.2f}"])
    fee_rows.append(["Total Amount Paid", f"INR {txn.total_charged:,.2f}"])
    fee_rows.append(["Remaining Invoice Balance", f"INR {txn.invoice.balance_due:,.2f}"])

    fee_table = Table(fee_rows, colWidths=[370, 150])
    fee_table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#0A192F")),
                ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
                ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                ("FONTNAME", (0, -2), (-1, -2), "Helvetica-Bold"),
                ("BACKGROUND", (0, -2), (-1, -2), colors.HexColor("#F0F7EF")),
                ("ALIGN", (1, 0), (1, -1), "RIGHT"),
                ("FONTSIZE", (0, 0), (-1, -1), 10),
                ("TOPPADDING", (0, 0), (-1, -1), 8),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
                ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#CBD5E1")),
            ]
        )
    )
    elements.append(fee_table)
    elements.append(Spacer(1, 18))

    if txn.remarks:
        elements.append(Paragraph(f"<b>Remarks:</b> {txn.remarks}", styles["Normal"]))
        elements.append(Spacer(1, 10))

    elements.append(
        Paragraph(
            "<i>This is a computer-generated receipt issued by EduSure School ERP.</i>",
            styles["Normal"],
        )
    )

    doc.build(elements)
    buffer.seek(0)
    return buffer