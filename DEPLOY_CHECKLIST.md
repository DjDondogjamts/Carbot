# ✅ CarBot v2.0 Final Deployment Checklist
## Phase 1: External Services
[ ] Facebook Page + App created, Messenger tokens generated
[ ] Kimi Moonshot API key obtained (moonshot-v1-8k/32k enabled)
[ ] Google Service Account created, Drive folder shared as Viewer
[ ] Discord webhook created for admin alerts
[ ] Khanbank SMS alerts enabled on your phone
[ ] SMS Forwarder app configured to forward bank SMS to:
    POST https://<your-railway-url>/api/payment-sms?secret=YOUR_SMS_FORWARD_SECRET

## Phase 2: Railway Deploy
[ ] Push code to private GitHub
[ ] Create new Railway project, deploy from repo
[ ] Add PostgreSQL service, copy DATABASE_URL to env vars
[ ] Fill ALL environment variables from .env.example
[ ] Deploy first build, confirm successful startup
[ ] Run sql/schema.sql in Railway PostgreSQL console
[ ] Run sql/seed_prompts.sql in Railway PostgreSQL console
[ ] Upload your fixed Khanbank QR to assets/qr_khanbank.png, redeploy

## Phase 3: Testing
[ ] Facebook webhook verified at /api/webhook
[ ] Test 100₮ payment flow: QR → SMS → auto session unlock
[ ] Test all 3 car categories end-to-end
[ ] Test zurkhai opt-in/opt-out flow
[ ] Test partial payment → mismatch alert
[ ] Test admin panel access at /admin
[ ] Test prompt edit via admin → confirm no redeploy needed
[ ] Test manual payment override for failed AI matches

## Phase 4: Launch
[ ] Soft launch to 2-3 test users
[ ] Monitor Discord alerts for 24 hours
[ ] Check token cost report daily for first week
[ ] Full launch after 3 successful end-to-end tests
