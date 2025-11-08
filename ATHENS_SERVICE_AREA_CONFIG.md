# Athens Metro Area - Service Configuration

## Geographic Scope
This E-Clean platform is designed specifically for the **Athens Metropolitan Area, Greece (Attica Region)**.

## Service Coverage

### Primary Service Area: Athens Metro
- **Center Point**: Syntagma Square (37.9838°N, 23.7275°E)
- **Metropolitan Radius**: ~50 km from city center
- **Population**: ~3.8 million (metropolitan area)

### Key Neighborhoods & Districts

#### Central Athens (Urban Core)
- **Kolonaki** - Upscale residential/shopping (10671)
- **Plaka** - Historic district (10558)
- **Monastiraki** - Central market area (10555)
- **Syntagma** - Parliament square (10563)
- **Exarchia** - University district (10683)
- **Koukaki** - Residential near Acropolis (11742)

#### Northern Suburbs
- **Kifisia** - Upscale suburb (14562-14564)
- **Maroussi** - Business district (15122-15127)
- **Psychiko** - Residential (15452)
- **Chalandri** - Family suburb (15231-15238)
- **Amarousi** - Near Olympic venues (15124)

#### Southern Suburbs (Coastal)
- **Glyfada** - Beach resort (16674-16675)
- **Voula** - Coastal residential (16673)
- **Vouliagmeni** - Upscale beach (16671)
- **Alimos** - Marina area (17455)

#### Piraeus (Port Area)
- **Piraeus Center** - Main port (18531-18545)
- **Kastella** - Hillside neighborhood (18533)
- **Zea Marina** - Yacht harbor (18536)

#### Eastern Athens
- **Pallini** - Suburban (15351)
- **Gerakas** - Outer suburb (15344)
- **Glyka Nera** - Residential (15354)

#### Western Athens
- **Peristeri** - Residential (12131-12136)
- **Aegaleo** - Urban (12243)
- **Aigaleo** - Industrial/residential (12242)

## Default Search Parameters

### Distance Measurements
- **Default Search Radius**: 15 km (≈9.3 miles)
- **Minimum Radius**: 5 km (central areas)
- **Maximum Radius**: 50 km (entire metropolitan area)
- **Average Travel Time**: 30-45 minutes within metro area

### Regional Divisions Used in System

1. **Central Athens**
   - Radius: 10 km from Syntagma
   - Postal Codes: 10xxx-11xxx
   - Typical travel time: 15-30 min

2. **North Athens & Suburbs**
   - Center: Kifisia/Maroussi (38.0487°N, 23.8095°E)
   - Radius: 15 km
   - Postal Codes: 145xx, 151xx, 152xx
   - Typical travel time: 30-45 min

3. **Piraeus & Coastal**
   - Center: Piraeus Port (37.9413°N, 23.6464°E)
   - Radius: 8 km
   - Postal Codes: 166xx-194xx, 185xx
   - Typical travel time: 25-40 min

## Coordinate Reference

### Key Landmarks
```
Syntagma Square:     37.9838°N, 23.7275°E
Acropolis:           37.9715°N, 23.7257°E
Piraeus Port:        37.9413°N, 23.6464°E
Athens Airport:      37.9364°N, 23.9445°E
Kifisia Center:      38.0744°N, 23.8109°E
Glyfada Beach:       37.8652°N, 23.7537°E
Maroussi:            38.0561°N, 23.8086°E
Kolonaki Square:     37.9795°N, 23.7404°E
```

### Distance Reference
```
Syntagma → Piraeus:       ~10 km (20 min)
Syntagma → Kifisia:       ~15 km (30 min)
Syntagma → Glyfada:       ~17 km (35 min)
Syntagma → Airport:       ~35 km (40-60 min)
Syntagma → Marathon:      ~42 km (60 min)
Piraeus → Glyfada:        ~12 km (25 min)
```

## Postal Code System

### Structure
- **Format**: 5 digits (XXXXX)
- **First 2 digits**: Area code
- **Last 3 digits**: Specific zone

### Common Prefixes
- **10-11**: Central Athens
- **12**: Western suburbs
- **13**: South/Southeast
- **14-15**: Northern suburbs
- **16-17**: Southern coastal
- **18-19**: Piraeus & coast

## Test Data Configuration

### Test Cleaners
1. **cleaner1@test.com** - Maria Papadopoulos
   - Service Area 1: Central Athens (10km radius from Syntagma)
   - Service Area 2: Piraeus & Coastal (8km radius from Piraeus)

2. **cleaner2@test.com** - Carlos Rodriguez  
   - Service Area: North Athens & Suburbs (15km radius from Maroussi)

### Test Properties
1. **Kolonaki Apartment**
   - Address: 45 Voukourestiou Street, Athens 10671
   - Coordinates: 37.9795°N, 23.7404°E
   - Type: 2BR apartment, 850 sq ft

2. **Glyfada House**
   - Address: 23 Lakonias Avenue, Glyfada 16674
   - Coordinates: 37.8652°N, 23.7537°E
   - Type: 3BR house, 1200 sq ft

3. **Maroussi Apartment**
   - Address: 12 Kifisias Avenue, Maroussi 15124
   - Coordinates: 38.0561°N, 23.8086°E
   - Type: 1BR apartment, 600 sq ft

## Currency & Measurements

### Defaults
- **Currency**: Euro (€)
- **Distance**: Kilometers (km) with miles shown as reference
- **Area**: Square meters (m²) or square feet (sq ft)
- **Temperature**: Celsius (°C)

### Conversions Used
- 1 mile = 1.60934 km
- 1 km = 0.621371 miles
- 1 sq meter = 10.764 sq ft

## Transportation Context

### Public Transit
- **Metro Lines**: 3 lines covering major areas
- **Suburban Railway**: Connecting suburbs to center
- **Tram**: Coastal line (Syntagma to Glyfada)
- **Buses**: Extensive network

### Travel Time Considerations
- **Peak Hours**: 7-10 AM, 5-8 PM (add 50% to travel time)
- **Off-Peak**: Reliable 20-30 min for 10km
- **Weekend**: Lighter traffic, faster travel

## API Configuration

### Search Defaults
```json
{
  "city": "Athens",
  "state": "Attica", 
  "country": "Greece",
  "max_radius": 15,
  "unit": "km"
}
```

### Example Searches
```bash
# Find cleaners near Syntagma Square
GET /api/auth/search-cleaners/?latitude=37.9838&longitude=23.7275&max_radius=10

# Find cleaners in Kolonaki
GET /api/auth/search-cleaners/?city=Athens&postal_code=10671

# Find cleaners in northern suburbs
GET /api/auth/search-cleaners/?latitude=38.0561&longitude=23.8086&max_radius=15
```

## User Experience Considerations

### Location Input
- GPS location is most accurate
- Postal code works well for specific neighborhoods
- City search covers broad areas

### Cleaner Assignment
- Recommend showing travel time estimate
- Prioritize cleaners with <30 min travel time
- Consider traffic patterns for scheduling

### Service Quality
- Urban areas: Higher cleaner density
- Suburbs: May have longer wait times
- Coastal areas: Premium pricing typical

---

**Note**: This configuration is specifically designed for the Athens metropolitan area and should not be extended to other Greek cities without geographic reconfiguration.
