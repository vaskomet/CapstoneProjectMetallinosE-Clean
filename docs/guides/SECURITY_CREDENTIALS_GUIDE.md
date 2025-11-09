# Security Credentials Management Guide

## ⚠️ CRITICAL: Never Commit Secrets to Git!

This project has been updated to properly handle sensitive credentials. **All API keys, secrets, and passwords must be stored in `.env.dev.local` or `.env.prod` which are NOT tracked by git.**

---

## File Structure

### ✅ Safe to Commit (Templates Only)
- `.env.example` - Example with placeholder values
- `.env.prod.template` - Production template with placeholders
- `.env.dev` - Development template (NOW CONTAINS PLACEHOLDERS ONLY)

### ❌ NEVER Commit (Contains Real Secrets)
- `.env.dev.local` - Your actual development secrets (git-ignored)
- `.env.prod` - Actual production secrets (git-ignored)
- Any file with real API keys

---

## Setup Instructions

### 1. Create Your Local Secrets File

Copy the template and add your real credentials:

```bash
cp .env.dev .env.dev.local
```

Then edit `.env.dev.local` with your actual secrets:

```bash
# .env.dev.local
GOOGLE_OAUTH_CLIENT_ID=your_actual_client_id
GOOGLE_OAUTH_CLIENT_SECRET=your_actual_secret
EMAIL_HOST_PASSWORD=your_actual_sendgrid_key
STRIPE_SECRET_KEY=your_actual_stripe_key
```

### 2. Verify Git Ignore

Ensure `.env.dev.local` is ignored:

```bash
git status --ignored | grep .env.dev.local
# Should show: .env.dev.local (if it exists)
```

---

## Secrets Inventory

### Google OAuth
**Location**: `.env.dev.local`
```bash
GOOGLE_OAUTH_CLIENT_ID=702945059943-xxxxx.apps.googleusercontent.com
GOOGLE_OAUTH_CLIENT_SECRET=GOCSPX-xxxxx
```
**Get From**: https://console.cloud.google.com/apis/credentials

### SendGrid SMTP
**Location**: `.env.dev.local`
```bash
EMAIL_HOST=smtp.sendgrid.net
EMAIL_PORT=587
EMAIL_USE_TLS=True
EMAIL_HOST_USER=apikey
EMAIL_HOST_PASSWORD=SG.xxxxx
```
**Get From**: https://app.sendgrid.com/settings/api_keys

### Stripe (Test Mode)
**Location**: `.env.dev.local`
```bash
STRIPE_SECRET_KEY=sk_test_xxxxx
STRIPE_PUBLISHABLE_KEY=pk_test_xxxxx
STRIPE_WEBHOOK_SECRET=whsec_xxxxx
```
**Get From**: https://dashboard.stripe.com/test/apikeys

### Django Secret Key
**Location**: `.env.dev.local` (dev) or `.env.prod` (production)
```bash
DJANGO_SECRET_KEY=your-unique-secret-key
```
**Generate**: `python -c 'from django.core.management.utils import get_random_secret_key; print(get_random_secret_key())'`

---

## Production Deployment

### On Your Server:

1. **Create `.env.prod` file** (NOT tracked by git):
```bash
cd /path/to/project
nano .env.prod
```

2. **Add production secrets**:
```bash
DJANGO_SECRET_KEY=production-secret-key-here
GOOGLE_OAUTH_CLIENT_ID=production-client-id
GOOGLE_OAUTH_CLIENT_SECRET=production-client-secret
EMAIL_HOST_PASSWORD=production-sendgrid-key
STRIPE_SECRET_KEY=sk_live_xxxxx  # LIVE MODE!
```

3. **Update docker-compose.prod.yml** to use `.env.prod`:
```yaml
services:
  backend:
    env_file:
      - .env.prod
```

---

## Security Checklist

- [ ] All real API keys are in `.env.dev.local` or `.env.prod`
- [ ] `.env.dev.local` and `.env.prod` are in `.gitignore`
- [ ] `.env.dev` contains ONLY placeholders, no real secrets
- [ ] Documentation files (`.md`) contain NO real API keys
- [ ] `git status` shows no sensitive files staged for commit
- [ ] Team members know to create their own `.env.dev.local`

---

## If You Accidentally Committed Secrets

### 1. **Rotate ALL compromised credentials immediately**:
- Google OAuth: Create new client ID/secret
- SendGrid: Delete exposed API key, create new one
- Stripe: Roll your API keys
- Django: Generate new SECRET_KEY

### 2. **Remove from Git history**:
```bash
# WARNING: This rewrites history - coordinate with team!
git filter-branch --force --index-filter \
  "git rm --cached --ignore-unmatch .env.dev" \
  --prune-empty --tag-name-filter cat -- --all

git push origin --force --all
```

### 3. **Update `.gitignore` and commit**:
```bash
echo ".env.dev" >> .gitignore
git add .gitignore
git commit -m "chore: add .env.dev to gitignore"
git push
```

---

## Team Onboarding

When a new developer joins:

1. **They should NOT have access to production secrets**
2. **They create their own `.env.dev.local`**:
   ```bash
   cp .env.dev .env.dev.local
   # Then fill in with their own test credentials
   ```
3. **They get their own test API keys**:
   - Google OAuth: Create new test project
   - SendGrid: Create new test account
   - Stripe: Use their own test mode keys

---

## Additional Resources

- [OWASP Secrets Management](https://cheatsheetseries.owasp.org/cheatsheets/Secrets_Management_Cheat_Sheet.html)
- [GitHub Secret Scanning](https://docs.github.com/en/code-security/secret-scanning/about-secret-scanning)
- [12 Factor App - Config](https://12factor.net/config)

---

## Current Status

✅ **Fixed**: All secrets removed from git-tracked files  
✅ **Fixed**: `.env.dev` now contains only placeholders  
✅ **Fixed**: `.env.dev` added to `.gitignore`  
✅ **Fixed**: Documentation updated to hide real API keys  
⚠️ **Action Required**: Rotate any compromised credentials if `.env.dev` was previously committed with secrets
