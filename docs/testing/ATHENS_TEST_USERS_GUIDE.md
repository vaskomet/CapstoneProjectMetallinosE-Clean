# Athens Metro Test Users - GPS Service Areas Only

**Created:** November 2, 2025  
**Command:** `python manage.py create_athens_users`  
**Status:** ✅ Complete

## Overview

Created comprehensive test users for Athens Metro area with **GPS + radius service areas only**. All cleaners use the consistent location model (center point + radius) that matches the client search system.

## Test Users Created

### 🧹 Cleaners (7 new + 2 existing)

| Email | Name | Service Area | Center Location | Radius | Purpose |
|-------|------|--------------|----------------|--------|---------|
| `cleaner.central@test.gr` | Maria Katsarou | Central Athens | 37.9838°N, 23.7275°E (Syntagma) | 5 km | Central Athens coverage |
| `cleaner.north@test.gr` | Giorgos Nikolaou | Kifisia & North Suburbs | 38.0746°N, 23.8114°E (Kifisia) | 10 km | Northern suburbs |
| `cleaner.south@test.gr` | Katerina Papadaki | Glyfada & Coastal South | 37.8652°N, 23.7537°E (Glyfada) | 8 km | Southern coastal area |
| `cleaner.piraeus@test.gr` | Yannis Dimitriou | Piraeus Port Area | 37.9413°N, 23.6464°E (Piraeus) | 5 km | Piraeus port region |
| `cleaner.wide@test.gr` | Andreas Petrou | Wide Athens Metro | 37.9838°N, 23.7275°E (Central) | 20 km | Full metro coverage |
| `cleaner.far.north@test.gr` | Michalis Stavrou | Far North (Ekali) | 38.0950°N, 23.8350°E (Ekali) | 5 km | **OUT OF RANGE** test |
| `cleaner.far.south@test.gr` | Ioanna Alexiou | Far South (Vouliagmeni) | 37.8167°N, 23.7833°E (Vouliagmeni) | 5 km | **OUT OF RANGE** test |
| `vaskoclean@mail.com` | (existing) | Agia Paraskevi | - | - | Existing user |
| `vaskoclean2@mail.com` | (existing) | - | - | - | Existing user |

**Password for all:** `cleaner123`

---

### 👥 Clients (4 new + 1 existing)

| Email | Name | Property Location | Coordinates | Property Type |
|-------|------|-------------------|-------------|---------------|
| `client.kolonaki@test.gr` | Dimitris Papadopoulos | 45 Voukourestiou St, Kolonaki | 37.9795°N, 23.7404°E | Apartment (850 sqft) |
| `client.syntagma@test.gr` | Maria Georgiou | 12 Mitropoleos St, Syntagma | 37.9755°N, 23.7348°E | Apartment (1200 sqft) |
| `client.glyfada@test.gr` | Nikos Konstantinou | 89 Lakonias Ave, Glyfada | 37.8652°N, 23.7537°E | House (2000 sqft) |
| `client.kifisia@test.gr` | Alexandros Vlahos | 56 Kolokotroni St, Kifisia | 38.0746°N, 23.8114°E | House (2500 sqft) |
| `vaskoclient@mail.com` | (existing) | Athens | - | - |

**Password for all:** `client123`

---

## Geographic Coverage Map

```
                    Far North (Ekali) ⚠️
                    38.0950°N - OUT OF RANGE
                           ↑ 10km away
                           
               Kifisia (North Cleaner)
               38.0746°N, 23.8114°E
                    ⭕ 10km radius
                           
                  Central Athens
               37.9838°N, 23.7275°E
    ⭕ Central (5km) ⭕ Wide (20km)
                           
    Piraeus                     East
    37.9413°N                   Areas
    ⭕ 5km                       
                           
                  Glyfada (South)
                  37.8652°N, 23.7537°E
                       ⭕ 8km
                           
                  Vouliagmeni ⚠️
                  37.8167°N - OUT OF RANGE
                           
Legend:
⭕ = Service area radius
⚠️ = Intentionally outside typical search range
```

---

## Testing Scenarios

### Scenario 1: Central Athens Client Search
**Login:** `client.syntagma@test.gr` (Syntagma Square)  
**Location:** 37.9755°N, 23.7348°E  
**Search Radius:** 15 km

**Expected Results:**
- ✅ `cleaner.central@test.gr` (Maria) - ~0.9 km away
- ✅ `cleaner.wide@test.gr` (Andreas) - ~0.9 km away, 20km radius covers everything
- ❌ `cleaner.north@test.gr` - Might appear (10km from Kifisia, but Syntagma is ~11km from Kifisia)
- ❌ `cleaner.far.north@test.gr` - Should NOT appear (~13-14km away)
- ❌ `cleaner.far.south@test.gr` - Should NOT appear (~16-17km away)

---

### Scenario 2: North Suburbs Client Search
**Login:** `client.kifisia@test.gr` (Kifisia)  
**Location:** 38.0746°N, 23.8114°E  
**Search Radius:** 15 km

**Expected Results:**
- ✅ `cleaner.north@test.gr` (Giorgos) - 0 km away (same location)
- ✅ `cleaner.wide@test.gr` (Andreas) - ~10 km away
- ✅ `cleaner.far.north@test.gr` (Michalis) - ~2.5 km away
- ❌ `cleaner.central@test.gr` - Might appear (5km radius but Kifisia is ~11km away)
- ❌ `cleaner.south@test.gr` - Should NOT appear (~25km away)
- ❌ `cleaner.piraeus@test.gr` - Should NOT appear (~17km away)

---

### Scenario 3: South Coast Client Search
**Login:** `client.glyfada@test.gr` (Glyfada)  
**Location:** 37.8652°N, 23.7537°E  
**Search Radius:** 15 km

**Expected Results:**
- ✅ `cleaner.south@test.gr` (Katerina) - 0 km away (same location)
- ✅ `cleaner.wide@test.gr` (Andreas) - ~13 km away
- ✅ `cleaner.far.south@test.gr` (Ioanna) - ~6 km away
- ❌ `cleaner.central@test.gr` - Outside range (~13km but only 5km radius)
- ❌ `cleaner.north@test.gr` - Should NOT appear (~25km away)

---

### Scenario 4: Piraeus Client Search
**Login:** Create a client near Piraeus Port (37.9413°N, 23.6464°E)  
**Search Radius:** 10 km

**Expected Results:**
- ✅ `cleaner.piraeus@test.gr` (Yannis) - 0 km away
- ✅ `cleaner.wide@test.gr` (Andreas) - ~7 km away
- ❌ All others should be outside range

---

## Distance Reference (Athens Metro)

| From → To | Distance | Notes |
|-----------|----------|-------|
| Syntagma → Kifisia | ~11 km | Central to North suburbs |
| Syntagma → Glyfada | ~13 km | Central to South coast |
| Syntagma → Piraeus | ~8 km | Central to Port |
| Syntagma → Ekali (far north) | ~14 km | Outside typical range |
| Syntagma → Vouliagmeni (far south) | ~18 km | Outside typical range |
| Kifisia → Ekali | ~2.5 km | Both in far north |
| Glyfada → Vouliagmeni | ~6 km | Both on south coast |

---

## Service Area Validation

### ✅ All Service Areas Are GPS-Based
- `area_type = 'radius'` for ALL cleaners
- All have `center_latitude` and `center_longitude`
- All have `radius_miles` defined
- `city`-based service areas: **0** (deleted)

### Search Algorithm
```python
1. Client provides: latitude, longitude, max_radius
2. Backend queries: ServiceArea.filter(area_type='radius')
3. For each service area:
   distance = haversine(client_lat, client_lng, area_center_lat, area_center_lng)
   if distance <= area.radius_miles:
       include_cleaner()
4. Sort by distance (closest first)
```

---

## Management Command

### Create/Recreate Users
```bash
cd backend
python manage.py create_athens_users
```

**What it does:**
1. Deletes any cleaners with `city`-based service areas
2. Deletes existing test users (by email) if they exist
3. Creates fresh cleaners with GPS service areas
4. Creates fresh clients with properties
5. Validates all service areas are GPS-based

### Delete All Test Users (if needed)
```python
# In Django shell
from django.contrib.auth import get_user_model
User = get_user_model()

# Delete all test users
User.objects.filter(email__contains='@test.gr').delete()
```

---

## Key Features for Testing

### GPS Location Search
- Click "Get My Location" button
- Browser requests permission
- Automatic search with current coordinates
- Radius slider (5-50 km)
- Real-time distance display

### Expected Behaviors
- ✅ Only cleaners with overlapping service areas appear
- ✅ Results sorted by distance (closest first)
- ✅ Distance shown in miles or km
- ✅ Service area badges displayed
- ✅ "Message" button for each cleaner
- ❌ No cleaners from other cities appear
- ❌ No city-based service areas exist

---

## Troubleshooting

### Issue: Seeing cleaners from wrong areas
**Check:**
1. Service area `area_type` = `'radius'` (not `'city'`)
2. Client location coordinates are correct
3. Search radius is appropriate
4. Backend search uses `find_cleaners_by_location()` not `find_cleaners_by_city()`

### Issue: No cleaners showing
**Check:**
1. Cleaners have GPS coordinates set
2. Service areas are `is_active=True`
3. Search radius is large enough
4. Browser has location permission

### Issue: Distance calculation wrong
**Check:**
1. Using Haversine formula (not Euclidean)
2. Coordinates in decimal degrees (not DMS)
3. Radius units consistent (miles in DB, km in frontend)

---

## Next Steps

1. ✅ Test client searches from different areas
2. ✅ Verify distance calculations are accurate
3. ✅ Confirm far north/south cleaners don't appear in central searches
4. ✅ Test DM creation from search results
5. ⏳ Add more cleaners if needed for specific test cases

---

**All passwords:** `cleaner123` for cleaners, `client123` for clients  
**Total Test Users:** 9 cleaners, 5 clients  
**Service Areas:** 9 GPS-based (radius), 0 city-based ✅
