# Database Best Practices

## PostgreSQL Sequence Management

### Problem: ID Collisions

When creating records via SQL scripts or Django shell commands, PostgreSQL's auto-increment sequences don't automatically update. This causes ID collisions when creating new records through the application.

**Example Error:**
```
ERROR: Payment already exists for this job (Payment #16)
```

### Solution: Reset Sequences After Manual Data Creation

#### Quick Fix (Recommended)
```bash
python manage.py reset_sequences
```

This command:
- ✅ Scans all Django models
- ✅ Resets each table's sequence to MAX(id) + 1
- ✅ Prevents ID collisions
- ✅ Safe to run anytime

#### Options
```bash
# Reset specific table
python manage.py reset_sequences --table payments_payment

# Verbose output (shows all tables)
python manage.py reset_sequences --verbose
```

---

## Best Practices for Data Creation

### 1. **Always Use Django ORM** (Preferred)
```python
# ✅ GOOD - Automatically manages sequences
from cleaning_jobs.models import CleaningJob

job = CleaningJob.objects.create(
    client=client,
    property=property,
    # ... other fields
)
```

### 2. **Use Management Commands** (Preferred)
```python
# ✅ GOOD - Encapsulated, reusable, version-controlled
# backend/core/management/commands/create_test_data.py

from django.core.management.base import BaseCommand
from cleaning_jobs.models import CleaningJob

class Command(BaseCommand):
    def handle(self, *args, **options):
        job = CleaningJob.objects.create(...)
```

Run with:
```bash
python manage.py create_test_data
```

### 3. **Raw SQL (Use With Caution)**
```python
# ⚠️ OK - But requires sequence reset afterward
from django.db import connection

with connection.cursor() as cursor:
    cursor.execute("""
        INSERT INTO cleaning_jobs_cleaningjob (client_id, property_id, ...)
        VALUES (%s, %s, ...);
    """, [client_id, property_id, ...])

# 🔧 REQUIRED - Reset sequence after raw SQL
python manage.py reset_sequences --table cleaning_jobs_cleaningjob
```

### 4. **Django Fixtures** (Good for Consistent Test Data)
```bash
# Export data
python manage.py dumpdata cleaning_jobs --indent 2 > fixtures/jobs.json

# Load data (automatically handles sequences)
python manage.py loaddata fixtures/jobs.json
```

---

## Industry Standards

### UUID Primary Keys (Alternative Approach)

For distributed systems or when you want globally unique IDs:

```python
import uuid
from django.db import models

class CleaningJob(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    # ... other fields
```

**Pros:**
- ✅ No sequence collisions ever
- ✅ Can generate IDs client-side
- ✅ Great for distributed systems
- ✅ Merging databases is easy

**Cons:**
- ❌ Larger storage (16 bytes vs 4-8 bytes)
- ❌ Slower indexing
- ❌ Not human-readable (e.g., `550e8400-e29b-41d4-a716-446655440000` vs `123`)
- ❌ Harder to debug

### Sequential IDs (Current Approach) ✅

**When to use:**
- ✅ Single database instance
- ✅ Human-readable IDs needed
- ✅ Performance-critical (smaller indexes)
- ✅ Order matters (auto-sorted by creation)

**Just remember:**
```bash
# Run after any manual data insertion
python manage.py reset_sequences
```

---

## Common Scenarios

### Scenario 1: Creating Test Users
```python
# ✅ RECOMMENDED
python manage.py create_test_users

# If you used raw SQL:
python manage.py reset_sequences
```

### Scenario 2: Migrating Data
```bash
# Step 1: Import data (however you do it)
python import_data.py

# Step 2: Reset sequences
python manage.py reset_sequences

# Step 3: Verify
python manage.py shell -c "from users.models import User; User.objects.create(username='test')"
```

### Scenario 3: Production Deployment
```bash
# In your deployment script
python manage.py migrate
python manage.py reset_sequences  # Safety check
python manage.py collectstatic --noinput
```

---

## Troubleshooting

### Error: "duplicate key value violates unique constraint"
```bash
# This means sequences are out of sync
python manage.py reset_sequences --verbose
```

### Error: "relation does not exist"
```bash
# Make sure migrations are applied
python manage.py migrate
python manage.py reset_sequences
```

### Verify Sequences Are Correct
```python
python manage.py shell -c "
from django.db import connection

with connection.cursor() as cursor:
    cursor.execute('''
        SELECT 
            schemaname || '.' || tablename as table,
            last_value,
            is_called
        FROM pg_sequences
        WHERE schemaname = 'public'
        ORDER BY tablename;
    ''')
    
    for row in cursor.fetchall():
        print(f'{row[0]:<40} Last: {row[1]:>6} Called: {row[2]}')
"
```

---

## Monitoring & Prevention

### Add to Your Development Workflow

1. **After creating test data:**
   ```bash
   python manage.py reset_sequences
   ```

2. **In your README:**
   ```markdown
   ## Setup Test Data
   1. `python manage.py create_test_users`
   2. `python manage.py create_test_properties`
   3. `python manage.py reset_sequences`  ← Don't forget!
   ```

3. **Pre-commit hook (optional):**
   ```bash
   # .git/hooks/pre-push
   #!/bin/bash
   python manage.py reset_sequences
   ```

---

## Summary

| Method | Sequence Management | Use Case |
|--------|-------------------|----------|
| Django ORM | ✅ Automatic | Day-to-day development |
| Management Commands | ✅ Automatic | Test data, scripts |
| Fixtures | ✅ Automatic | Consistent test data |
| Raw SQL | ⚠️ Manual (`reset_sequences`) | Bulk operations |
| UUID Primary Keys | ✅ No sequences needed | Distributed systems |

**Golden Rule:** When in doubt, run `python manage.py reset_sequences` 🎯
