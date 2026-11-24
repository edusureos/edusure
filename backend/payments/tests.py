from datetime import date
from decimal import Decimal

from django.contrib.auth import get_user_model
from rest_framework import status
from rest_framework.test import APITestCase

from users.models import StudentProfile

from .models import FeeStructure, PaymentTransaction, StudentFeeInvoice


User = get_user_model()


class FeeCollectorAPITests(APITestCase):
    def setUp(self):
        self.admin = User.objects.create_user(
            username="1012260001",
            password="test-password",
            role=User.Role.SCHOOL_ADMIN,
            school_id=101,
        )
        self.student = User.objects.create_user(
            username="1010260001",
            password="test-password",
            role=User.Role.STUDENT,
            school_id=101,
            phone_number="9876543210",
        )
        StudentProfile.objects.create(
            user=self.student,
            admission_number="ADM-26-01",
            first_name="Aarav",
            last_name="Singh",
            class_grade="7",
            section="A",
            roll_number=2,
            registered_phone="9876543210",
        )
        self.structure = FeeStructure.objects.create(
            school_id=101,
            title="Monthly Fee",
            class_grade="7",
            amount=Decimal("2500.00"),
            late_fee=Decimal("10.00"),
            due_date=date(2026, 6, 5),
        )
        self.invoice = StudentFeeInvoice.objects.create(
            school_id=101,
            student=self.student,
            fee_structure=self.structure,
            title=self.structure.title,
            base_amount=self.structure.amount,
            late_fee_amount=self.structure.late_fee,
            due_date=self.structure.due_date,
        )
        self.client.force_authenticate(user=self.admin)

    def test_paged_invoice_search_includes_student_identity_and_payment_count(self):
        response = self.client.get(
            "/api/payments/admin/invoices/",
            {"page": 1, "page_size": 20, "student_id": "ADM-26"},
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["count"], 1)
        invoice_data = response.data["results"][0]
        self.assertEqual(invoice_data["student_id"], self.student.username)
        self.assertEqual(invoice_data["admission_number"], "ADM-26-01")
        self.assertEqual(invoice_data["registered_phone"], "9876543210")
        self.assertEqual(invoice_data["payment_count"], 0)
        self.assertEqual(invoice_data["fee_structure_id"], self.structure.id)

    def test_invoice_schedule_updates_and_saves_default_for_future_assignments(self):
        response = self.client.patch(
            f"/api/payments/admin/invoices/{self.invoice.id}/",
            {
                "base_amount": "3000.00",
                "schedule_start_month": "2026-06-01",
                "schedule_end_month": "2026-09-01",
                "period_type": "MONTHLY",
                "late_penalty_enabled": True,
                "late_fee_amount": "25.00",
                "penalty_period": "PER_DAY",
                "due_day": 15,
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.invoice.refresh_from_db()
        self.assertEqual(self.invoice.total_amount, Decimal("3025.00"))
        self.assertEqual(self.invoice.schedule_start_month, date(2026, 6, 1))
        self.assertEqual(self.invoice.period_type, "MONTHLY")

        response = self.client.post(
            f"/api/payments/admin/invoices/{self.invoice.id}/save-as-default/",
            {},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.structure.refresh_from_db()
        self.assertEqual(self.structure.amount, Decimal("3000.00"))
        self.assertEqual(self.structure.late_fee, Decimal("25.00"))
        self.assertEqual(self.structure.penalty_period, "PER_DAY")
        self.assertEqual(self.structure.due_day, 15)
        self.assertEqual(self.structure.due_date, date(2026, 6, 15))

        future_student = User.objects.create_user(
            username="1010260002",
            password="test-password",
            role=User.Role.STUDENT,
            school_id=101,
        )
        StudentProfile.objects.create(
            user=future_student,
            first_name="Future",
            class_grade="7",
            section="A",
        )
        response = self.client.post(
            "/api/payments/admin/invoices/assign/",
            {
                "fee_structure_id": self.structure.id,
                "class_grade": "7",
                "section": "A",
                "student_ids": [future_student.username],
            },
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        assigned_invoice = StudentFeeInvoice.objects.get(student=future_student)
        self.assertEqual(assigned_invoice.schedule_start_month, date(2026, 6, 1))
        self.assertEqual(assigned_invoice.period_type, "MONTHLY")
        self.assertEqual(assigned_invoice.due_day, 15)
        self.assertEqual(assigned_invoice.due_date, date(2026, 6, 15))

    def test_paid_invoice_amount_is_locked_and_student_history_is_not_capped(self):
        for index in range(205):
            PaymentTransaction.objects.create(
                school_id=101,
                invoice=self.invoice,
                student=self.student,
                amount=Decimal("1.00"),
                convenience_fee=Decimal("0.00"),
                total_charged=Decimal("1.00"),
                payment_mode=PaymentTransaction.Mode.CASH,
                status=PaymentTransaction.Status.SUCCESS,
                remarks=f"Payment {index}",
            )

        response = self.client.patch(
            f"/api/payments/admin/invoices/{self.invoice.id}/",
            {"base_amount": "2600.00"},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("base_amount", response.data)

        response = self.client.get(
            "/api/payments/admin/transactions/",
            {"student_id": self.student.username},
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 205)

    def test_invoice_edit_is_scoped_to_admin_school(self):
        other_student = User.objects.create_user(
            username="1020260001",
            password="test-password",
            role=User.Role.STUDENT,
            school_id=102,
        )
        other_invoice = StudentFeeInvoice.objects.create(
            school_id=102,
            student=other_student,
            title="Other school fee",
            base_amount=Decimal("1000.00"),
            due_date=date(2026, 6, 5),
        )

        response = self.client.patch(
            f"/api/payments/admin/invoices/{other_invoice.id}/",
            {"base_amount": "1200.00"},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)
