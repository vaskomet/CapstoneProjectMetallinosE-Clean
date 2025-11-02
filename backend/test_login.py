import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'e_clean_backend.settings')
django.setup()

from django.contrib.auth import get_user_model

User = get_user_model()
email = 'cleaner.central@test.gr'

print(f"Testing login for: {email}")
print(f"Email has '@': {'@' in email}")

try:
    user = User.objects.get(email=email)
    print(f"✅ User found: {user.email}")
    print(f"   Username: {user.username}")
    print(f"   Is active: {user.is_active}")
    print(f"   Password check: {user.check_password('cleaner123')}")
except User.DoesNotExist:
    print(f"❌ User NOT found with email: {email}")
