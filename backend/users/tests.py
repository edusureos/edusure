import tempfile
from pathlib import Path

from django.contrib.auth import get_user_model
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import override_settings
from rest_framework import status
from rest_framework.test import APITestCase

from .models import Attendance, Notice, StudentProfile, TeacherProfile
from .serializers import NoticeSerializer


User = get_user_model()


class NoticeManagementTests(APITestCase):
    endpoint = '/api/users/notices/'

    def setUp(self):
        self.media_dir = tempfile.TemporaryDirectory()
        media_settings = override_settings(MEDIA_ROOT=self.media_dir.name)
        media_settings.enable()
        self.addCleanup(media_settings.disable)
        self.addCleanup(self.media_dir.cleanup)
        self.admin = User.objects.create_user(
            username='1012260091',
            password='test-password',
            role=User.Role.SCHOOL_ADMIN,
            school_id=101,
        )
        self.client.force_authenticate(user=self.admin)

    def test_admin_can_create_update_and_delete_notice_with_attachment(self):
        upload = SimpleUploadedFile(
            'assembly.pdf',
            b'%PDF-1.7\nnotice details',
            content_type='application/pdf',
        )
        response = self.client.post(
            self.endpoint,
            {
                'title': 'Assembly',
                'content': 'Assembly is at 9 AM.',
                'target_roles': ['STUDENT', 'TEACHER'],
                'target_classes': '["6A","7B"]',
                'attachment': upload,
            },
            format='multipart',
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data['target_roles'], ['STUDENT', 'TEACHER'])
        self.assertEqual(response.data['target_classes'], ['6A', '7B'])
        self.assertIn('/media/notices/school_101/', response.data['attachment'])
        notice = Notice.objects.get(pk=response.data['id'])
        attachment_path = Path(notice.attachment.path)
        self.assertTrue(attachment_path.exists())

        response = self.client.patch(
            f'{self.endpoint}{notice.pk}/',
            {
                'title': 'Updated assembly',
                'target_roles': ['TEACHER'],
                'target_classes': '[]',
            },
            format='multipart',
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['title'], 'Updated assembly')
        self.assertEqual(response.data['target_roles'], ['TEACHER'])
        self.assertEqual(response.data['target_classes'], [])
        self.assertEqual(Path(Notice.objects.get(pk=notice.pk).attachment.path), attachment_path)

        response = self.client.delete(f'{self.endpoint}{notice.pk}/')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertFalse(Notice.objects.filter(pk=notice.pk).exists())
        self.assertFalse(attachment_path.exists())

    def test_notice_attachments_reject_wrong_file_signatures_and_oversize_files(self):
        base_data = {
            'title': 'Attachment checks',
            'content': 'Test attachment validation.',
            'target_roles': ['ALL'],
            'target_classes': [],
        }
        invalid_signature = NoticeSerializer(data={
            **base_data,
            'attachment': SimpleUploadedFile('invalid.pdf', b'not a PDF'),
        })
        self.assertFalse(invalid_signature.is_valid())
        self.assertIn('attachment', invalid_signature.errors)

        oversize = NoticeSerializer(data={
            **base_data,
            'attachment': SimpleUploadedFile(
                'large.pdf',
                b'%PDF-' + b'x' * (10 * 1024 * 1024),
            ),
        })
        self.assertFalse(oversize.is_valid())
        self.assertIn('attachment', oversize.errors)


class BulkStudentEnrollmentTests(APITestCase):
    endpoint = '/api/users/bulk-enroll/'

    def test_student_cannot_bulk_enroll(self):
        student = User.objects.create_user(
            username='1010260001',
            password='test-password',
            role=User.Role.STUDENT,
            school_id=101,
        )
        self.client.force_authenticate(user=student)

        response = self.client.post(self.endpoint, {}, format='multipart')

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_school_admin_import_is_scoped_to_admin_school(self):
        admin = User.objects.create_user(
            username='1012260001',
            password='test-password',
            role=User.Role.SCHOOL_ADMIN,
            school_id=101,
        )
        self.client.force_authenticate(user=admin)
        upload = SimpleUploadedFile(
            'students.csv',
            b'userid,first_name,last_name,class,section,mobile_number,dob,father_name\n'
            b'1010260002,Ada,Lovelace,6,A,1234567890,,Guardian\n',
            content_type='text/csv',
        )

        response = self.client.post(
            self.endpoint,
            {'file': upload, 'school_code': '999'},
            format='multipart',
        )

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data['total_processed'], 1)
        imported_student = User.objects.get(username='1010260002')
        self.assertEqual(imported_student.school_id, 101)


class ClassAttendanceMedicalTests(APITestCase):
    endpoint = '/api/users/attendance/class/'

    def test_school_admin_can_mark_medical_attendance(self):
        admin = User.objects.create_user(
            username='1012260001',
            password='test-password',
            role=User.Role.SCHOOL_ADMIN,
            school_id=101,
        )
        student = User.objects.create_user(
            username='1010260001',
            password='test-password',
            role=User.Role.STUDENT,
            school_id=101,
        )
        StudentProfile.objects.create(
            user=student,
            first_name='Ada',
            class_grade='A1',
            section='A',
        )
        self.client.force_authenticate(user=admin)

        response = self.client.post(
            self.endpoint,
            {
                'date': '2026-11-17',
                'records': [{
                    'student_id': student.username,
                    'status': Attendance.Status.MEDICAL,
                    'remarks': 'Medical leave',
                }],
            },
            format='json',
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(
            Attendance.objects.get(student=student, date='2026-11-17').status,
            Attendance.Status.MEDICAL,
        )


class AttendanceReportsTests(APITestCase):
    endpoint = '/api/users/attendance/reports/'

    def setUp(self):
        self.admin = User.objects.create_user(
            username='1012260002',
            password='test-password',
            role=User.Role.SCHOOL_ADMIN,
            school_id=101,
        )
        self.present_student = User.objects.create_user(
            username='1010260003', role=User.Role.STUDENT, school_id=101,
        )
        self.other_student = User.objects.create_user(
            username='1010260004', role=User.Role.STUDENT, school_id=101,
        )
        self.other_class_student = User.objects.create_user(
            username='1010260005', role=User.Role.STUDENT, school_id=101,
        )
        self.outside_student = User.objects.create_user(
            username='1020260001', role=User.Role.STUDENT, school_id=102,
        )
        self.present_profile = StudentProfile.objects.create(
            user=self.present_student, first_name='Ada', class_grade='A1', section='A', roll_number=1,
        )
        StudentProfile.objects.create(
            user=self.other_student, first_name='Grace', class_grade='A1', section='A', roll_number=2,
        )
        StudentProfile.objects.create(
            user=self.other_class_student, first_name='Katherine', class_grade='B1', section='B',
        )
        StudentProfile.objects.create(
            user=self.outside_student, first_name='Outside', class_grade='B1', section='B',
        )
        Attendance.objects.create(
            school_id=101, student=self.present_student, date='2026-11-01', status=Attendance.Status.PRESENT,
        )
        Attendance.objects.create(
            school_id=101, student=self.present_student, date='2026-11-02', status=Attendance.Status.ABSENT,
        )
        Attendance.objects.create(
            school_id=101, student=self.present_student, date='2026-10-31', status=Attendance.Status.PRESENT,
        )
        Attendance.objects.create(
            school_id=101, student=self.other_student, date='2026-11-01', status=Attendance.Status.PRESENT,
        )
        self.client.force_authenticate(user=self.admin)

    def test_date_class_and_low_attendance_filters_use_actual_records(self):
        response = self.client.get(self.endpoint, {
            'report_type': 'class',
            'start_date': '2026-11-01',
            'end_date': '2026-11-30',
            'class_grade': 'A1',
            'section': 'A',
            'comparison': 'lt',
            'percentage': '75',
        })

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual([item['student_id'] for item in response.data['students']], [self.present_student.username])
        self.assertEqual(response.data['students'][0]['total_days'], 2)
        self.assertEqual(response.data['students'][0]['attendance_percentage'], 50.0)
        self.assertEqual(response.data['summary']['present'], 1)
        self.assertEqual(response.data['summary']['absent'], 1)
        self.assertEqual(response.data['summary']['attendance_percentage'], 50.0)

    def test_student_report_returns_date_history_and_dynamic_classes(self):
        response = self.client.get(self.endpoint, {
            'report_type': 'student',
            'start_date': '2026-11-01',
            'end_date': '2026-11-30',
            'search': self.present_student.username,
            'student_id': self.present_student.username,
        })

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['selected_student']['name'], 'Ada')
        self.assertEqual(
            [record['date'] for record in response.data['student_records']],
            ['2026-11-02', '2026-11-01'],
        )
        self.assertEqual(response.data['class_options'], [
            {'class_grade': 'A1', 'sections': ['A']},
            {'class_grade': 'B1', 'sections': ['B']},
        ])

    def test_percentage_comparison_uses_unrounded_attendance(self):
        student = User.objects.create_user(
            username='1010260006', role=User.Role.STUDENT, school_id=101,
        )
        StudentProfile.objects.create(
            user=student, first_name='Katherine', class_grade='A1', section='A',
        )
        for day, attendance_status in (
            ('2026-11-01', Attendance.Status.PRESENT),
            ('2026-11-02', Attendance.Status.PRESENT),
            ('2026-11-03', Attendance.Status.ABSENT),
        ):
            Attendance.objects.create(
                school_id=101, student=student, date=day, status=attendance_status,
            )

        response = self.client.get(self.endpoint, {
            'start_date': '2026-11-01',
            'end_date': '2026-11-30',
            'search': student.username,
            'comparison': 'lt',
            'percentage': '66.67',
        })

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['students'][0]['attendance_percentage'], 66.7)

    def test_faculty_reports_are_limited_to_assigned_class(self):
        teacher = User.objects.create_user(
            username='1011260002', role=User.Role.TEACHER, school_id=101,
        )
        TeacherProfile.objects.create(
            user=teacher, first_name='Teacher', class_teacher_of='A1-A',
        )
        self.client.force_authenticate(user=teacher)

        response = self.client.get(self.endpoint, {
            'start_date': '2026-11-01',
            'end_date': '2026-11-30',
        })
        denied_response = self.client.get(self.endpoint, {
            'start_date': '2026-11-01',
            'end_date': '2026-11-30',
            'class_grade': 'B1',
        })

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['class_options'], [{'class_grade': 'A1', 'sections': ['A']}])
        self.assertEqual(denied_response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_faculty_marking_is_limited_to_assigned_class(self):
        teacher = User.objects.create_user(
            username='1011260003', role=User.Role.TEACHER, school_id=101,
        )
        TeacherProfile.objects.create(
            user=teacher, first_name='Teacher', class_teacher_of='A1-A',
        )
        self.client.force_authenticate(user=teacher)

        assigned_response = self.client.get('/api/users/attendance/class/', {
            'class_grade': 'A1', 'date': '2026-11-01',
        })
        view_response = self.client.get('/api/users/attendance/class/', {
            'class_grade': 'B1', 'section': 'B', 'date': '2026-11-01',
        })
        mark_response = self.client.post('/api/users/attendance/class/', {
            'date': '2026-11-01',
            'records': [{
                'student_id': self.other_class_student.username,
                'status': Attendance.Status.PRESENT,
            }],
        }, format='json')
        summary_response = self.client.get('/api/users/attendance/summary/', {
            'student_id': self.other_class_student.username,
        })

        self.assertEqual(assigned_response.status_code, status.HTTP_200_OK)
        self.assertEqual(assigned_response.data['section'], 'A')
        self.assertEqual(assigned_response.data['total_students'], 2)
        self.assertEqual(view_response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(mark_response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertEqual(summary_response.status_code, status.HTTP_404_NOT_FOUND)

    def test_invalid_date_ranges_and_percentages_are_rejected(self):
        reversed_range = self.client.get(self.endpoint, {
            'start_date': '2026-11-30', 'end_date': '2026-11-01',
        })
        invalid_percentage = self.client.get(self.endpoint, {
            'comparison': 'gt', 'percentage': '101',
        })

        self.assertEqual(reversed_range.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(invalid_percentage.status_code, status.HTTP_400_BAD_REQUEST)

# Create your tests here.
