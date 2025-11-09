# E-Clean Test Credentials

**Quick Reference for Testing**

---

## 🔑 Login Credentials

### Admin Account
```
Email:    admin@ecloud.com
Password: admin123
Role:     Admin
Access:   Full system administration
```

### Client Accounts

#### Client 1 - John Papadopoulos
```
Email:    client1@test.com
Password: client123
Role:     Client
Location: Athens
Property: Apartment at Voukourestiou 25 (915 sqft)
```

#### Client 2 - Maria Konstantinou
```
Email:    client2@test.com
Password: client123
Role:     Client
Location: Thessaloniki
Property: House at Vasilissis Olgas 120 (1615 sqft)
```

### Cleaner Accounts

#### Cleaner 1 - Dimitris Georgiou
```
Email:    cleaner1@test.com
Password: cleaner123
Role:     Cleaner
Location: Athens
Service Area: Athens Central
```

#### Cleaner 2 - Elena Nikolaou
```
Email:    cleaner2@test.com
Password: cleaner123
Role:     Cleaner
Location: Thessaloniki
Service Area: Thessaloniki Central
```

---

## 📊 Test Data Summary

### Existing Jobs
- **Job #3**: Deep cleaning in Athens (Status: open_for_bids)
  - Client: John (client1@test.com)
  - 2 Bids: Dimitris ($120) and Elena ($110)

- **Job #4**: Regular cleaning in Thessaloniki (Status: open_for_bids)
  - Client: Maria (client2@test.com)
  - 1 Bid: Elena ($90)

---

## 🧪 Test Scenarios

### Scenario 1: Create a New Job
1. Login as **client1@test.com**
2. Navigate to "Create Job" or similar
3. Fill in job details
4. Submit
5. **Expected**: Cleaners receive notification

### Scenario 2: Submit a Bid
1. Login as **cleaner1@test.com**
2. View available jobs
3. Submit a bid on a job
4. **Expected**: Client receives notification

### Scenario 3: Accept a Bid
1. Login as **client1@test.com**
2. View Job #3
3. Accept one of the bids
4. **Expected**: Cleaner receives acceptance notification

---

## 🔄 Reset Test Data

To recreate all test data from scratch:

```bash
docker exec ecloud_backend_dev python manage.py create_test_data
```

This will:
- Clear all existing data
- Create 5 users (1 admin, 2 clients, 2 cleaners)
- Create 2 service areas
- Create 2 properties
- Create 2 jobs
- Create 3 bids
- Create 4 notification templates

---

## 📡 WebSocket Testing

### Connection URL
```
ws://localhost:8000/ws/notifications/{user_id}/
```

### Test in Browser Console
```javascript
// Replace {user_id} with actual user ID after login
const ws = new WebSocket('ws://localhost:8000/ws/notifications/1/');

ws.onopen = () => console.log('✅ WebSocket connected');
ws.onmessage = (event) => console.log('📨 Message:', JSON.parse(event.data));
ws.onerror = (error) => console.error('❌ Error:', error);
ws.onclose = () => console.log('🔌 WebSocket closed');
```

---

## 🐛 Troubleshooting

### Wrong Email Domain?
- ❌ **cleaner1@eclean.com** → Wrong!
- ✅ **cleaner1@test.com** → Correct!

All test emails end with `@test.com` except admin which is `@ecloud.com`

### Login Fails with 400 Error
- Check you're using the correct email domain (`@test.com`)
- Verify password is exactly `client123`, `cleaner123`, or `admin123`
- Check browser console for exact error message

### No Notifications Appearing
1. Check event subscriber is running: `docker logs ecloud_event_subscriber_dev --tail 20`
2. Check WebSocket connection in browser console
3. Verify Redis is running: `docker ps | grep redis`

---

*Last Updated: October 23, 2025*
