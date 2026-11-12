import os
import firebase_admin
from firebase_admin import credentials
from django.apps import AppConfig
from django.conf import settings

class UsersConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'users'

    def ready(self):
        # Initialize Firebase Admin only once
        if not firebase_admin._apps:
            # Point to your secured JSON key
            key_path = os.path.join(settings.BASE_DIR, 'firebase-adminsdk.json')
            
            if os.path.exists(key_path):
                cred = credentials.Certificate(key_path)
                firebase_admin.initialize_app(cred)
                print("Firebase Initialized Successfully! 🚀")
            else:
                print("Warning: firebase-adminsdk.json not found in the root directory.")