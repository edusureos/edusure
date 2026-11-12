"""
Django settings for edusure project.
"""

from pathlib import Path
import os
import firebase_admin
from firebase_admin import credentials

# Build paths inside the project like this: BASE_DIR / 'subdir'.
BASE_DIR = Path(__file__).resolve().parent.parent

# -----------------------------------------------------------------------------
# Security & Environment Settings
# -----------------------------------------------------------------------------
# In production, define these in your .env file or environment variables
SECRET_KEY = os.environ.get(
    'DJANGO_SECRET_KEY', 
    'django-insecure-^^o#17-z0)1q_9hl3)$k&@am%a$9c_xq1=%i392es3quidc*b^'
)

DEBUG = os.environ.get('DJANGO_DEBUG', 'True').lower() in ('true', '1', 't')

ALLOWED_HOSTS = os.environ.get('ALLOWED_HOSTS', '127.0.0.1,localhost').split(',')


# -----------------------------------------------------------------------------
# Application Definition
# -----------------------------------------------------------------------------
INSTALLED_APPS = [
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
    
    # 3rd Party
    'rest_framework',
    'rest_framework_simplejwt',
    'corsheaders',
    'drf_spectacular',
    'rest_framework_simplejwt.token_blacklist', 

    # Local Apps
    'users',
    'academics',
    'finance',
]

MIDDLEWARE = [
    'django.middleware.security.SecurityMiddleware',
    'corsheaders.middleware.CorsMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
]

ROOT_URLCONF = 'edusure.urls'

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
            ],
        },
    },
]

WSGI_APPLICATION = 'edusure.wsgi.application'


# -----------------------------------------------------------------------------
# Database Setup (SQLite for Local Dev / PostgreSQL ready for Production)
# -----------------------------------------------------------------------------
# Reads DATABASE_URL if set (PostgreSQL), otherwise defaults to SQLite
DATABASE_URL = os.environ.get('DATABASE_URL')

if DATABASE_URL:
    import dj_database_url
    DATABASES = {
        'default': dj_database_url.parse(
            DATABASE_URL,
            conn_max_age=600,
            conn_health_checks=True,
        )
    }
else:
    DATABASES = {
        'default': {
            'ENGINE': 'django.db.backends.sqlite3',
            'NAME': BASE_DIR / 'db.sqlite3',
        }
    }


# -----------------------------------------------------------------------------
# Password Validation
# -----------------------------------------------------------------------------
AUTH_PASSWORD_VALIDATORS = [
    {
        'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator',
    },
    {
        'NAME': 'users.validators.StrongPasswordValidator',
    },
]


# -----------------------------------------------------------------------------
# Internationalization
# -----------------------------------------------------------------------------
LANGUAGE_CODE = 'en-us'
TIME_ZONE = 'Asia/Kolkata'  # Updated to IST timezone for accurate attendance & logging
USE_I18N = True
USE_TZ = True


# -----------------------------------------------------------------------------
# Static & Media Files
# -----------------------------------------------------------------------------
STATIC_URL = 'static/'
STATIC_ROOT = BASE_DIR / 'staticfiles'

MEDIA_URL = 'media/'
MEDIA_ROOT = BASE_DIR / 'media'


# -----------------------------------------------------------------------------
# Custom App Settings
# -----------------------------------------------------------------------------

# 1. Custom User Model
AUTH_USER_MODEL = 'users.User'

# 2. CORS Policy
CORS_ALLOW_ALL_ORIGINS = True  # Production mein specific origins list set karenge

# 3. Django REST Framework & JWT Configuration
REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': (
        'rest_framework_simplejwt.authentication.JWTAuthentication',
    ),
    'DEFAULT_SCHEMA_CLASS': 'drf_spectacular.openapi.AutoSchema',
}

# 4. Swagger UI Settings
SPECTACULAR_SETTINGS = {
    'TITLE': 'Edusure API',
    'DESCRIPTION': 'Enterprise API documentation for Edusure School ERP',
    'VERSION': '1.0.0',
    'SERVE_INCLUDE_SCHEMA': False,
}

# 5. Firebase Admin SDK Initialization
FIREBASE_CRED_PATH = BASE_DIR / 'firebase_key.json'

if FIREBASE_CRED_PATH.exists() and not firebase_admin._apps:
    cred = credentials.Certificate(str(FIREBASE_CRED_PATH))
    firebase_admin.initialize_app(cred)