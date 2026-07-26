# 🚗 CarBot Mongolia v2.0 - Toyota Standard Production
Official Messenger bot for car verification, market analysis, and traditional zurkhai compatibility.
Built with Toyota 3S service philosophy: Accurate, Friendly, Trustworthy.

## Core Features
✅ 3 car categories: Imported / New / Used
✅ 5 service tiers with configurable pricing/limits
✅ AI-powered Khanbank SMS payment verification
✅ Authoritative traditional zurkhai (Gandan Monastery standard) for car purchase
✅ Editable AI prompts via admin panel (no redeploy needed)
✅ Toyota 7-step customer service standard
✅ Weekly Kimi business intelligence reports
✅ Real-time Discord alerts for sales/errors/prompt changes
✅ Built-in admin dashboard
✅ Token cost tracking & profitability reporting
✅ Full configurability via environment variables + database

## Deploy Steps
1. Add your Khanbank QR as `assets/qr_khanbank.png`
2. Zip folder → push to private GitHub repo
3. Railway → New Project → Deploy from repo
4. Add PostgreSQL service → run `sql/schema.sql` then `sql/seed_prompts.sql`
5. Fill all environment variables from `.env.example`
6. Deploy → connect Facebook webhook → configure SMS forwarder
7. Access admin panel at `/admin` with your ADMIN_API_KEY

Full deployment checklist: `DEPLOY_CHECKLIST.md`
