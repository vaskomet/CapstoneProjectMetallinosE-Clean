#!/bin/bash

# Security Incident Response Script
# This script helps rotate compromised credentials that were committed to git

set -e

echo "🚨 SECURITY CREDENTIAL ROTATION SCRIPT"
echo "======================================"
echo ""
echo "⚠️  WARNING: This will help you rotate credentials that may have been"
echo "   exposed in git history."
echo ""

read -p "Have you reviewed SECURITY_CREDENTIALS_GUIDE.md? (y/n) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Please read SECURITY_CREDENTIALS_GUIDE.md first!"
    exit 1
fi

echo ""
echo "📋 CREDENTIALS TO ROTATE:"
echo "========================"
echo ""
echo "1. Google OAuth Credentials"
echo "   - Go to: https://console.cloud.google.com/apis/credentials"
echo "   - Delete old client ID: 702945059943-g9pu5q6qr6e1e4d2rgosh9la6f4fq052"
echo "   - Create new OAuth 2.0 Client ID"
echo "   - Update .env.dev.local with new credentials"
echo ""

read -p "✓ Have you rotated Google OAuth credentials? (y/n) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Please rotate Google OAuth credentials first!"
    exit 1
fi

echo ""
echo "2. SendGrid API Key"
echo "   - Go to: https://app.sendgrid.com/settings/api_keys"
echo "   - Delete old key: SG.fiMY_wAERaKS_Avaro83Ow..."
echo "   - Create new API key with 'Mail Send' permission"
echo "   - Update .env.dev.local with new key"
echo ""

read -p "✓ Have you rotated SendGrid API key? (y/n) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Please rotate SendGrid API key first!"
    exit 1
fi

echo ""
echo "3. Django Secret Key"
echo "   - Generate new key:"
python3 -c 'from django.core.management.utils import get_random_secret_key; print(get_random_secret_key())'
echo "   - Update .env.dev.local with new DJANGO_SECRET_KEY"
echo ""

read -p "✓ Have you updated Django Secret Key in .env.dev.local? (y/n) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Please update Django Secret Key first!"
    exit 1
fi

echo ""
echo "✅ All credentials rotated!"
echo ""
echo "📝 NEXT STEPS:"
echo "============="
echo ""
echo "1. Test your application with new credentials:"
echo "   docker compose -f docker-compose.dev.yml restart backend"
echo ""
echo "2. Commit the updated template files:"
echo "   git add .env.dev .gitignore SENDGRID_SMTP_SETUP.md"
echo "   git commit -m 'security: Remove hardcoded secrets, add placeholders'"
echo ""
echo "3. (OPTIONAL) Remove secrets from git history:"
echo "   ⚠️  WARNING: This rewrites history - coordinate with your team!"
echo ""
echo "   git filter-branch --force --index-filter \\"
echo "     'git rm --cached --ignore-unmatch .env.dev' \\"
echo "     --prune-empty --tag-name-filter cat -- --all"
echo ""
echo "   git push origin --force --all"
echo ""
echo "4. Verify .env.dev.local is NOT tracked:"
echo "   git status --ignored | grep .env.dev.local"
echo ""
echo "5. Inform team members to create their own .env.dev.local:"
echo "   cp .env.dev .env.dev.local"
echo "   # Then fill in with their own test credentials"
echo ""

echo "✅ DONE! Your credentials have been rotated."
echo "   Make sure to restart your Docker containers."
