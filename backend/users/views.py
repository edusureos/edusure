import random
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework_simplejwt.views import TokenObtainPairView
from rest_framework_simplejwt.tokens import RefreshToken
from drf_spectacular.utils import extend_schema
from rest_framework import status, permissions
from firebase_admin import auth as firebase_auth
from django.contrib.auth import get_user_model
from .models import User, OTPStore
from .serializers import (
    UserProfileSerializer,
    CustomLoginSerializer,
    FirstLoginPasswordChangeSerializer,
    UserSerializer,
    SendOTPSerializer,
    VerifyOTPAndResetPasswordSerializer,
    FirebaseLoginSerializer,
)

class CustomLoginView(TokenObtainPairView):
    serializer_class = CustomLoginSerializer

class FirstLoginPasswordChangeView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        serializer = FirstLoginPasswordChangeSerializer(data=request.data)
        if serializer.is_valid():
            user = request.user
            user.set_password(serializer.validated_data['new_password'])
            user.requires_password_change = False
            user.save()
            return Response(
                {"detail": "Password updated successfully. You can now access your dashboard."},
                status=status.HTTP_200_OK
            )
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

class SendOTPView(APIView):
    """Generates 4-digit OTP for Forgot Password"""
    @extend_schema(request=SendOTPSerializer)
    def post(self, request):
        serializer = SendOTPSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        identifier = serializer.validated_data['identifier']
        user = User.objects.filter(username=identifier).first() or User.objects.filter(phone_number=identifier).first()
        
        if not user or not user.phone_number:
            return Response({"detail": "User or registered phone number not found."}, status=status.HTTP_404_NOT_FOUND)

        otp_code = str(random.randint(1000, 9999))
        
        OTPStore.objects.filter(phone_number=user.phone_number).delete()
        OTPStore.objects.create(phone_number=user.phone_number, otp=otp_code)

        print(f"\n==========================================")
        print(f" [SMS MOCK] Sending OTP {otp_code} to {user.phone_number}")
        print(f"==========================================\n")

        return Response({"detail": "OTP sent successfully via SMS.", "phone_number": user.phone_number}, status=status.HTTP_200_OK)

class VerifyOTPAndResetPasswordView(APIView):
    """Verifies OTP and updates user password"""
    @extend_schema(request=VerifyOTPAndResetPasswordSerializer)
    def post(self, request):
        serializer = VerifyOTPAndResetPasswordSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        phone_number = serializer.validated_data['phone_number']
        otp = serializer.validated_data['otp']
        new_password = serializer.validated_data['new_password']

        otp_obj = OTPStore.objects.filter(phone_number=phone_number, otp=otp).first()

        if not otp_obj:
            return Response({"detail": "Invalid or expired OTP."}, status=status.HTTP_400_BAD_REQUEST)

        user = User.objects.filter(phone_number=phone_number).first()
        if not user:
            return Response({"detail": "User not found."}, status=status.HTTP_404_NOT_FOUND)

        user.set_password(new_password)
        user.requires_password_change = False
        user.save()

        otp_obj.delete()

        return Response({"detail": "Password reset successfully. You can now log in."}, status=status.HTTP_200_OK)

class UserProfileView(APIView):
    permission_classes = [IsAuthenticated]

    @extend_schema(
        summary="Fetch logged-in user profile",
        responses={200: UserProfileSerializer}
    )
    def get(self, request):
        user = request.user
        sp = getattr(user, 'student_profile', None)

        if sp:
            full_name = f"{sp.first_name} {sp.last_name}".strip()
            class_display = f"{sp.class_grade} - {sp.section}" if (sp.class_grade and sp.section) else (sp.class_grade or "")
            dob_display = sp.dob.strftime("%d %b %Y") if sp.dob else ""
            father_name = sp.father_name or ""
            mobile = sp.registered_phone or user.phone_number or ""
        else:
            full_name = f"{user.first_name} {user.last_name}".strip()
            class_display = ""
            dob_display = ""
            father_name = ""
            mobile = user.phone_number or ""

        return Response({
            "username": user.username,
            "role": user.role,
            "studentName": full_name,
            "class": class_display,
            "dateOfBirth": dob_display,
            "fatherName": father_name,
            "mobileNumber": mobile,
        }, status=status.HTTP_200_OK)

    
class LogoutView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        try:
            refresh_token = request.data.get("refresh")
            token = RefreshToken(refresh_token)
            token.blacklist()
            return Response({"detail": "Successfully logged out."}, status=status.HTTP_200_OK)
        except Exception:
            return Response({"detail": "Invalid token or already blacklisted."}, status=status.HTTP_400_BAD_REQUEST)

# ==========================================
# Firebase Phone Auth Login View
# ==========================================
class FirebaseLoginView(APIView):
    permission_classes = [permissions.AllowAny]

    @extend_schema(
        summary="Login using Firebase Phone Auth ID Token",
        request=FirebaseLoginSerializer,
        responses={200: "JWT Access & Refresh Tokens"}
    )
    def post(self, request):
        serializer = FirebaseLoginSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        id_token = serializer.validated_data['id_token']

        try:
            # 1. Verify token with Firebase
            decoded_token = firebase_auth.verify_id_token(id_token)
            firebase_phone = decoded_token.get('phone_number')

            if not firebase_phone:
                return Response({"error": "No phone number found in token."}, status=status.HTTP_400_BAD_REQUEST)

            # 2. Extract last 10 digits to match country codes safely
            phone_clean = firebase_phone[-10:]

            # Lookup on User model first
            user = get_user_model().objects.filter(phone_number__endswith=phone_clean).first()

            # Fallback to student_profile if not found directly
            if not user:
                user = get_user_model().objects.filter(
                    student_profile__registered_phone__endswith=phone_clean
                ).first()

            if not user:
                return Response(
                    {"error": "User with this phone number not found in our ERP."}, 
                    status=status.HTTP_404_NOT_FOUND
                )

            # 3. Issue DRF JWT Tokens
            refresh = RefreshToken.for_user(user)
            
            return Response({
                'refresh': str(refresh),
                'access': str(refresh.access_token),
                'role': getattr(user, 'role', 'student'),
                'username': user.username
            }, status=status.HTTP_200_OK)

        except firebase_auth.InvalidIdTokenError:
            return Response({"error": "Invalid or expired Firebase token."}, status=status.HTTP_401_UNAUTHORIZED)
        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)