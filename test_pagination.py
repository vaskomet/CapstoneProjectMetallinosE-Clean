#!/usr/bin/env python3
"""
Test script for chat pagination API endpoints
Verifies that the new pagination parameters work correctly
"""

import requests
import json

BASE_URL = "http://localhost:8000/api"

# Test credentials
TEST_USERS = [
    {"email": "client1@test.com", "password": "client123"},
    {"email": "cleaner1@test.com", "password": "cleaner123"},
]

def login(email, password):
    """Login and get access token"""
    response = requests.post(
        f"{BASE_URL}/auth/login/",
        json={"email": email, "password": password}
    )
    if response.status_code == 200:
        return response.json()["access"]
    else:
        print(f"❌ Login failed: {response.status_code}")
        print(response.text)
        return None

def test_pagination(token):
    """Test pagination endpoints"""
    headers = {"Authorization": f"Bearer {token}"}
    
    print("\n📋 Testing Chat Room List")
    print("=" * 60)
    
    # Get chat rooms
    response = requests.get(f"{BASE_URL}/chat/rooms/", headers=headers)
    if response.status_code != 200:
        print(f"❌ Failed to get rooms: {response.status_code}")
        return
    
    rooms = response.json()
    print(f"✅ Found {len(rooms)} chat rooms")
    
    if not rooms:
        print("⚠️  No rooms found. Create a job to create a chat room first.")
        return
    
    # Test with first room
    room = rooms[0]
    room_id = room['id']
    print(f"\n🗨️  Testing Room #{room_id}: {room.get('name', 'Job Chat')}")
    print("=" * 60)
    
    # Test 1: Get messages without pagination (default)
    print("\n1️⃣  Test: Default messages (no params)")
    response = requests.get(
        f"{BASE_URL}/chat/rooms/{room_id}/messages/",
        headers=headers
    )
    if response.status_code == 200:
        data = response.json()
        print(f"   ✅ Success!")
        print(f"   📊 Message count: {data.get('count', len(data.get('messages', [])))}")
        print(f"   🔼 Has more: {data.get('has_more', 'N/A')}")
        print(f"   🆔 Oldest ID: {data.get('oldest_id', 'N/A')}")
        print(f"   🆔 Newest ID: {data.get('newest_id', 'N/A')}")
        
        messages = data.get('messages', [])
        if messages:
            oldest_id = data.get('oldest_id')
            newest_id = data.get('newest_id')
            
            # Test 2: Get messages with limit
            print("\n2️⃣  Test: With limit=10")
            response = requests.get(
                f"{BASE_URL}/chat/rooms/{room_id}/messages/?limit=10",
                headers=headers
            )
            if response.status_code == 200:
                data = response.json()
                print(f"   ✅ Success!")
                print(f"   📊 Message count: {len(data.get('messages', []))}")
                print(f"   🔼 Has more: {data.get('has_more', 'N/A')}")
            else:
                print(f"   ❌ Failed: {response.status_code}")
            
            # Test 3: Get messages before oldest (pagination)
            if oldest_id and data.get('has_more'):
                print(f"\n3️⃣  Test: Pagination (before={oldest_id})")
                response = requests.get(
                    f"{BASE_URL}/chat/rooms/{room_id}/messages/?before={oldest_id}&limit=10",
                    headers=headers
                )
                if response.status_code == 200:
                    data = response.json()
                    print(f"   ✅ Success!")
                    print(f"   📊 Message count: {len(data.get('messages', []))}")
                    print(f"   🔼 Has more: {data.get('has_more', 'N/A')}")
                    print(f"   🆔 Oldest ID: {data.get('oldest_id', 'N/A')}")
                else:
                    print(f"   ❌ Failed: {response.status_code}")
            
            # Test 4: Get messages after newest (catch-up)
            if newest_id:
                print(f"\n4️⃣  Test: Catch-up (after={newest_id})")
                response = requests.get(
                    f"{BASE_URL}/chat/rooms/{room_id}/messages/?after={newest_id}&limit=10",
                    headers=headers
                )
                if response.status_code == 200:
                    data = response.json()
                    print(f"   ✅ Success!")
                    print(f"   📊 Message count: {len(data.get('messages', []))}")
                    print(f"   📝 (Should be 0 if no new messages)")
                else:
                    print(f"   ❌ Failed: {response.status_code}")
        else:
            print("   ⚠️  Room has no messages yet")
    else:
        print(f"   ❌ Failed: {response.status_code}")
        print(f"   Response: {response.text[:200]}")

def main():
    """Main test runner"""
    print("🧪 Chat Pagination API Tests")
    print("=" * 60)
    
    # Test with client user
    user = TEST_USERS[0]
    print(f"\n🔐 Logging in as: {user['email']}")
    token = login(user['email'], user['password'])
    
    if token:
        print("✅ Login successful!")
        test_pagination(token)
    else:
        print("❌ Login failed. Cannot run tests.")
    
    print("\n" + "=" * 60)
    print("✅ Tests complete!")

if __name__ == "__main__":
    main()
