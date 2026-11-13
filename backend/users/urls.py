from django.urls import path
from .views import (
    CustomLoginView,
    FirstLoginPasswordChangeView,
    SendOTPView,
    VerifyOTPAndResetPasswordView,
    UserProfileView,
    LogoutView,
    FirebaseLoginView,
    AdminDashboardStatsView,       
    AdminStudentListCreateView,
    AdminStudentDetailView,
    AdminTeacherListCreateView,
    NoticeListCreateView,
)
from .bulk_views import BulkStudentEnrollmentView


urlpatterns = [
    # Auth endpoints
    path('login/', CustomLoginView.as_view(), name='login'),
    path('change-password/', FirstLoginPasswordChangeView.as_view(), name='change-password'),
    path('send-otp/', SendOTPView.as_view(), name='send-otp'),
    path('reset-password/', VerifyOTPAndResetPasswordView.as_view(), name='reset-password'),
    path('firebase-login/', FirebaseLoginView.as_view(), name='firebase-login'),

    # User profile & management endpoints
    path('me/', UserProfileView.as_view(), name='user-profile'),
    path('logout/', LogoutView.as_view(), name='logout'),
    path('bulk-enroll/', BulkStudentEnrollmentView.as_view(), name='bulk-student-enroll'),
    path('first-login-change-password/', FirstLoginPasswordChangeView.as_view(), name='first-login-change-password'),

    path('admin/stats/', AdminDashboardStatsView.as_view(), name='admin-stats'),
    path('admin/students/', AdminStudentListCreateView.as_view(), name='admin-students'),

    path('admin/students/<str:username>/', AdminStudentDetailView.as_view(), name='admin-student-detail'),
    path('admin/teachers/', AdminTeacherListCreateView.as_view(), name='admin-teachers'),
    path('notices/', NoticeListCreateView.as_view(), name='notices'),
    
]
