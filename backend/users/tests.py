from django.contrib.auth import get_user_model
from django.core.files.uploadedfile import SimpleUploadedFile
from rest_framework import status
from rest_framework.test import APITestCase

from .models import Attendance, StudentProfile


User = get_user_model()


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

# Create your tests here.
