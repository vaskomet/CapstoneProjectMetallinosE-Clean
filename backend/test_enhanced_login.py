#!/usr/bin/env python3
import os
import django
import json
import urllib.request
import urllib.parse
import urllib.error

# Setup Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'e_clean_backend.settings')
django.setup()

def test_login(email, password, description):
    print(f"\n🧪 {description}")
    print(f"   Email: {email}")
    print(f"   Password: {'*' * len(password) if password else '(empty)'}")
    
    login_url = "http://localhost:8000/api/auth/login/"
    test_data = {
        "email": email,
        "password": password
    }

    data = json.dumps(test_data).encode('utf-8')
    req = urllib.request.Request(
        login_url,
        data=data,
        headers={'Content-Type': 'application/json'}
    )

    try:
        with urllib.request.urlopen(req) as response:
            response_data = json.loads(response.read().decode('utf-8'))
            print(f"   ✅ Success! User: {response_data['user']['email']} ({response_data['user']['role']})")
                
    except urllib.error.HTTPError as e:
        try:
            error_body = e.read().decode('utf-8')
            error_data = json.loads(error_body)
            
            if 'detail' in error_data:
                print(f"   ❌ {error_data['detail']}")
            elif 'non_field_errors' in error_data:
                print(f"   ❌ {error_data['non_field_errors'][0]}")
            else:
                print(f"   ❌ {error_data}")
        except:
            print(f"   ❌ HTTP {e.code}: {e.reason}")
    except Exception as e:
        print(f"   ❌ Connection Error: {e}")

# Test different scenarios with specific error messages
print("🔐 Testing Enhanced Login Error Messages")
print("=" * 50)

# Test with existing users
from users.models import User
users = User.objects.all()[:2]  # Get first 2 users

if users:
    test_user = users[0]
    
    # Test scenarios
    test_login(test_user.email, "wrongpassword", "Wrong Password (should say 'Incorrect password')")
    test_login("nonexistent@example.com", "anypassword", "Wrong Email (should say 'No account found')")
    test_login("testuser@example.com", "testpass123", "Correct Credentials (should succeed)")
    test_login("", "testpass123", "Empty Email (field validation)")
    test_login("testuser@example.com", "", "Empty Password (field validation)")
    
    print(f"\n📧 Available test users:")
    for user in users:
        print(f"   - {user.email} (role: {user.role})")
    
    print(f"\n💡 Try logging in with:")
    print(f"   Email: testuser@example.com")
    print(f"   Password: testpass123")
else:
    print("No users found in database!")
    
print("\n" + "=" * 50)