# REVdating — Full Setup Guide

Follow every section in order. By the end the app will be running with a live database,
payments, photo moderation, email, maps, and push notifications.

---

## 1. Prerequisites

Install these before starting:

| Tool | Version | Install |
|---|---|---|
| Node.js | 20 LTS or higher | https://nodejs.org |
| npm | bundled with Node | — |
| Supabase CLI | latest | `npm install -g supabase` |
| Stripe CLI | latest | https://stripe.com/docs/stripe-cli |
| Git | any | https://git-scm.com |

---

## 2. Install Dependencies

```bash
npm install
```

---

## 3. Environment Variables

Copy the example file and fill it in as you work through each section below:

```bash
cp .env.example .env.local
```

Open `.env.local` in your editor and fill in values as you complete each step.

---

## 4. Supabase — Database Setup

You said you already have a Supabase project. Here is everything that needs to be
configured in it.

### 4a. Get your project credentials

1. Open your project at https://supabase.com/dashboard
2. Go to **Project Settings → API**
3. Copy these values into `.env.local`:

```
NEXT_PUBLIC_SUPABASE_URL=https://xxxxxxxxxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...   (anon / public key)
SUPABASE_SERVICE_ROLE_KEY=eyJ...        (service_role key — keep secret)
```

4. Go to **Project Settings → Database**
5. Copy the **Connection string** (URI format) and paste it as:

```
SUPABASE_DB_URL=postgresql://postgres:[YOUR-PASSWORD]@db.xxxxxxxxxxxx.supabase.co:5432/postgres
```

### 4b. Enable required database extensions

In your Supabase dashboard go to **Database → Extensions** and enable:

| Extension | Why |
|---|---|
| `uuid-ossp` | UUID primary keys |
| `postgis` | Lat/lng location queries |
| `pg_trgm` | Fuzzy text search |
| `pgcrypto` | Cryptographic functions |

To enable one: click the toggle next to the extension name. All four must show as **enabled**.

> Alternatively, run this in the SQL Editor:
> ```sql
> CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
> CREATE EXTENSION IF NOT EXISTS "postgis";
> CREATE EXTENSION IF NOT EXISTS "pg_trgm";
> CREATE EXTENSION IF NOT EXISTS "pgcrypto";
> ```

### 4c. Run all database migrations

This creates every table, index, trigger, RLS policy, and function.
There are 24 migration files numbered 001–024.

**Option A — Supabase CLI (recommended)**

Link your local project to your Supabase project, then push:

```bash
supabase login
supabase link --project-ref YOUR_PROJECT_REF
supabase db push
```

Your project ref is the part after `https://supabase.com/dashboard/project/` in the URL.

**Option B — Supabase SQL Editor (manual)**

If you can't use the CLI, run each migration file in order via the SQL Editor in
the dashboard (**Database → SQL Editor → New query**).

Run them in this exact order:
```
001_initial_schema.sql
002_rls_policies.sql
003_functions.sql
004_update_discovery.sql
005_match_system.sql
006_safety_privacy.sql
007_premium_features.sql
008_compliance.sql
009_rev_it.sql
010_badges.sql
011_ride_dates.sql
012_club_association.sql
013_trust_status.sql
014_consolidated_schema.sql
015_rls_policies.sql
016_realtime_chat.sql
017_ride_date_planner.sql
018_revved_up_badge.sql
019_gdpr_compliance.sql
020_engine_revs.sql
021_ride_ratings.sql
022_email_notifications.sql
023_security_fixes.sql
024_private_buckets.sql
```

All files are in the `supabase/migrations/` folder.

> If you get a "type already exists" or "table already exists" error on an early
> migration, run the migrations from where the error stopped — the earlier ones
> ran fine.

### 4d. Verify storage buckets

The migrations create the app's storage buckets and policies. After running all
migrations, verify these buckets exist in **Storage**:

| Bucket | Public? | Purpose |
|---|---:|---|
| `profile-photos` | **Private** | Profile photos served through signed URLs |
| `bike-photos` | **Private** | Bike photos served through signed URLs |
| `verification-docs` | **Private** | Selfie/document verification uploads |

Important: migration `024_private_buckets.sql` intentionally makes
`profile-photos` and `bike-photos` private and clears stale permanent public URLs.
Do **not** turn these buckets public in production. The application generates
signed URLs at read time through the server/admin client.

If you create buckets manually before running migrations, use:
- Public bucket: **OFF** for all three buckets
- File size limit: `5 MB` for `profile-photos` and `bike-photos`
- File size limit: `10 MB` for `verification-docs`
- Allowed image MIME types: `image/jpeg`, `image/png`, `image/webp`, `image/heic`
- Add `application/pdf` only for `verification-docs`

Storage object policies are defined in the migrations. If a manual dashboard
change is required, keep the same model: authenticated users can manage their own
folder, authenticated users can read photo objects, and verification docs remain
limited to the owner/admin policy.

### 4e. Configure Supabase Auth

Go to **Authentication → URL Configuration**:

- **Site URL**: `http://localhost:3000` (change to your production domain before going live)
- **Redirect URLs**: Add `http://localhost:3000/auth/callback`
  Also add your production URL when you deploy: `https://yourdomain.com/auth/callback`

Go to **Authentication → Email Templates** and customise the confirmation and
password reset emails if desired. The defaults will work fine.

Go to **Authentication → Providers** and make sure **Email** is enabled.

### 4f. Enable Realtime

Go to **Database → Replication** and make sure the `messages` table is included
in the `supabase_realtime` publication (migration 016 does this automatically with
`supabase db push`, but verify it is listed).

### 4g. Set your app URL

```
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_APP_NAME=REVdating
```

Change `NEXT_PUBLIC_APP_URL` to your production domain before deploying.

Also set the internal webhook secret — generate a long random string:

```
INTERNAL_WEBHOOK_SECRET=some-very-long-random-string-here
```

On Mac/Linux you can generate one with: `openssl rand -hex 32`

### 4h. Netlify production environment variables

In Netlify, set production env vars under **Site configuration → Environment
variables**. At minimum, production must include:

```
NEXT_PUBLIC_SUPABASE_URL=https://xxxxxxxxxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
NEXT_PUBLIC_APP_URL=https://yourdomain.com
NEXT_PUBLIC_APP_NAME=REVdating
INTERNAL_WEBHOOK_SECRET=some-very-long-random-string-here
```

Keep `SUPABASE_SERVICE_ROLE_KEY` server-only. Never prefix it with
`NEXT_PUBLIC_`, and never paste it into client-side code.

Optional development/demo flags are disabled by default:

```
DEV_BYPASS_AUTH=false
NEXT_PUBLIC_ENABLE_DEMO_LOGIN=false
```

`DEV_BYPASS_AUTH=true` only works outside production and should not be set for
Netlify production deploys. If demo reviewer login is enabled,
`NEXT_PUBLIC_DEMO_LOGIN_PASSWORD` is browser-visible; use only a throwaway demo
account and keep demo login disabled in normal production.

---

## 5. Stripe — Payments

### 5a. Create a Stripe account

Sign up at https://stripe.com. Use **test mode** during development.

### 5b. Get your API keys

Go to **Developers → API keys**:

```
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_SECRET_KEY=sk_test_...
```

### 5c. Create subscription products

Go to **Product catalogue → Add product** and create **two products**:

**Product 1 — Rider Plus**
- Name: `Rider Plus`
- Add two prices:
  - Monthly recurring — note the price ID (`price_...`)
  - Yearly recurring — note the price ID (`price_...`)

**Product 2 — Rider Premium**
- Name: `Rider Premium`
- Add two prices:
  - Monthly recurring — note the price ID
  - Yearly recurring — note the price ID

Add the four price IDs to `.env.local`:

```
STRIPE_PRICE_RIDER_PLUS_MONTHLY=price_...
STRIPE_PRICE_RIDER_PLUS_YEARLY=price_...
STRIPE_PRICE_RIDER_PREMIUM_MONTHLY=price_...
STRIPE_PRICE_RIDER_PREMIUM_YEARLY=price_...
```

> Legacy aliases also supported if you only want one tier:
> `STRIPE_PRICE_MONTHLY` and `STRIPE_PRICE_YEARLY`

### 5d. Set up the Stripe webhook

**For local development** — use the Stripe CLI to forward events:

```bash
stripe login
stripe listen --forward-to localhost:3000/api/stripe/webhook
```

The CLI will print a webhook signing secret (`whsec_...`). Add it:

```
STRIPE_WEBHOOK_SECRET=whsec_...
```

Keep the `stripe listen` command running in a terminal while developing.

**For production** — go to **Developers → Webhooks → Add endpoint**:

- Endpoint URL: `https://yourdomain.com/api/stripe/webhook`
- Events to listen for (select these four):
  - `checkout.session.completed`
  - `customer.subscription.created`
  - `customer.subscription.updated`
  - `customer.subscription.deleted`
  - `invoice.payment_failed`
- After saving, reveal the signing secret and add it to your production env vars.

### 5e. Configure the billing portal

Go to **Settings → Billing portal** in the Stripe dashboard and enable it.
Set the return URL to `https://yourdomain.com/settings`.

---

## 6. Resend — Transactional Emails

### 6a. Create an account

Sign up at https://resend.com. The free tier allows 3,000 emails/month.

### 6b. Add and verify your sending domain

1. Go to **Domains → Add domain**
2. Enter your domain (e.g. `yourdomain.com`)
3. Add the DNS records Resend gives you to your domain registrar
4. Click **Verify DNS records** once the records have propagated (can take a few minutes)

> You cannot send from an unverified domain. During development you can use
> Resend's test email (`onboarding@resend.dev`) as the `from` address — it works
> without domain verification.

### 6c. Get your API key

Go to **API Keys → Create API key**. Add to `.env.local`:

```
RESEND_API_KEY=re_...
RESEND_FROM_EMAIL=REVdating <noreply@yourdomain.com>
```

The `RESEND_FROM_EMAIL` address must be on your verified domain.
For testing, use `RESEND_FROM_EMAIL=onboarding@resend.dev`.

---

## 7. OpenAI — AI Helpers (optional)

AI Profile Helper v1 lets a logged-in user generate profile bio/headline ideas
from their own profile and primary bike data. AI Icebreaker v1 lets a logged-in
user generate opening-message suggestions for an active match from safe public
profile and bike details. AI Ride Date Planner v1 lets a matched user generate
safe, biker-friendly ride-date ideas from general public profile, city/country,
public bike, and lightweight preference context. AI Admin Moderation Assistant
v1 lets authorised admins generate recommendation-only report summaries from
limited report and public/safety context. AI Safety / Red-Flag Detection v1
checks only the message text immediately before a chat message is sent.
These AI helpers do **not** use private messages, full chat history, swipes,
reports unrelated to the selected moderation review, photos beyond the selected
report attachment, verification documents, emergency contacts, exact GPS
coordinates, exact addresses, payment details, or other private user data.

Set these variables in your server/deployment environment if you want the helper
enabled:

```bash
OPENAI_API_KEY=your_openai_api_key_here
OPENAI_PROFILE_HELPER_MODEL=gpt-5.4-nano
OPENAI_ICEBREAKER_MODEL=gpt-5.4-nano
OPENAI_SAFETY_MODEL=gpt-5.4-nano
OPENAI_RIDE_PLANNER_MODEL=gpt-5.4-nano
OPENAI_ADMIN_MODERATION_MODEL=gpt-5.4-nano
```

Security notes:

- Never prefix OpenAI keys with `NEXT_PUBLIC_`; do not create or configure
  `NEXT_PUBLIC_OPENAI_API_KEY`.
- OpenAI keys must only be used server-side.
- If `OPENAI_API_KEY` is missing, `/api/ai/profile-helper`,
  `/api/ai/icebreaker`, `/api/ai/ride-planner`, and
  `/api/admin/ai/moderation-summary` return `503`; the rest of the app still
  works.
- If AI safety is unavailable, rate-limited, or cannot validate the model
  output, normal messaging continues without blocking the user.
- The default example model is `gpt-5.4-nano` because profile copywriting is a
  simple text task. If your OpenAI API account does not support that model, the
  helper fails gracefully and shows a friendly error; change
  `OPENAI_PROFILE_HELPER_MODEL`, `OPENAI_ICEBREAKER_MODEL`,
  `OPENAI_SAFETY_MODEL`, `OPENAI_RIDE_PLANNER_MODEL`, or
  `OPENAI_ADMIN_MODERATION_MODEL` to another supported low-cost text model and
  redeploy.
- The AI helpers use the existing in-memory app rate limiter only; no Supabase
  AI tracking tables or migrations are used in v1.
- AI safety v1 does not add Supabase AI tracking tables, create migrations,
  auto-ban users, auto-report users, create admin actions, or send messages on
  the user's behalf.
- AI ride planner v1 does not use exact GPS coordinates, exact addresses, or
  location tracking. It does not save ride plans, create ride-date records,
  create calendar events, or send messages automatically.
- AI admin moderation v1 is recommendation-only and requires human admin review.
  It does not auto-ban, auto-warn, auto-delete, update report status, create
  admin actions, or save AI moderation summaries to Supabase.
- Generated profile text is never saved automatically. The user must copy or
  choose a suggestion and then save their profile manually.
- Generated icebreakers and ride-date message drafts are never sent
  automatically. The user must choose or edit a suggestion and then press the
  existing Send button manually.
- AI ride-date ideas are suggestions only and are not saved in Supabase in v1.
- AI safety warnings are shown before sending only. Medium-risk warnings allow
  the user to edit or choose Send anyway; high-risk warnings only allow editing.

---

## 8. Google Maps — Ride Date Planning

### 8a. Create a project and enable APIs

1. Go to https://console.cloud.google.com
2. Create a new project (or use an existing one)
3. Go to **APIs & Services → Enable APIs and Services**
4. Search and enable each of these three APIs:
   - **Maps JavaScript API**
   - **Places API**
   - **Maps Static API**

### 8b. Create an API key

1. Go to **APIs & Services → Credentials → Create credentials → API key**
2. Copy the key and add to `.env.local`:

```
NEXT_PUBLIC_GOOGLE_MAPS_KEY=AIza...
```

### 8c. Restrict the key (recommended)

- Under **Application restrictions**, select **HTTP referrers** and add your domain
- Under **API restrictions**, select **Restrict key** and select the three APIs above

---

## 9. Sightengine — Photo Moderation & Selfie Face Detection

### 9a. Create an account

Sign up at https://sightengine.com. The free tier allows 2,000 operations/month.

### 9b. Get your API credentials

Go to your dashboard and copy **API user** and **API secret**:

```
SIGHTENGINE_API_USER=your-api-user
SIGHTENGINE_API_SECRET=your-api-secret
```

This powers two things:
- Automatic NSFW/offensive content moderation when users upload profile photos
- Face detection on selfie verification submissions (rejects photos with no visible face)

> Without these keys the app falls back safely: profile photos are auto-approved,
> and selfie face detection is skipped (all selfies go to admin review).

---

## 10. Web Push Notifications

The current app implementation uses browser Web Push with VAPID keys, not
OneSignal. Generate VAPID keys with a trusted tool or `web-push`, then set:

```
NEXT_PUBLIC_VAPID_PUBLIC_KEY=your-public-vapid-key
VAPID_PRIVATE_KEY=your-private-vapid-key
VAPID_SUBJECT=mailto:hello@yourdomain.com
```

> Without `VAPID_PRIVATE_KEY`, push notifications are silently skipped. The app
> still works, but users will not receive push alerts.

Older `NEXT_PUBLIC_ONESIGNAL_APP_ID` / `ONESIGNAL_REST_API_KEY` values are legacy
and are not used by the current code path.

---

## 11. Sentry — Error Tracking (optional but recommended)

1. Sign up at https://sentry.io and create a **Next.js** project
2. Get your DSN from **Settings → Projects → [your project] → Client Keys**

```
NEXT_PUBLIC_SENTRY_DSN=https://...@sentry.io/...
SENTRY_AUTH_TOKEN=sntrys_...
SENTRY_ORG=your-org-slug
SENTRY_PROJECT=REVdating
```

---

## 12. PostHog — Product Analytics (optional)

1. Sign up at https://posthog.com and create a project
2. Copy the **Project API key** from your project settings

```
NEXT_PUBLIC_POSTHOG_KEY=phc_...
NEXT_PUBLIC_POSTHOG_HOST=https://app.posthog.com
```

---

## 13. Run the App

```bash
npm run dev
```

Open http://localhost:3000. You should see the REVdating landing/login page.

### 13a. Validate production runtime environment

`npm run build` can pass without production runtime environment variables because
Next.js builds pages before a production request context exists. Before any
production deployment, run:

```bash
npm run validate:env
```

This command fails with a non-zero exit code if required runtime variables are
missing. It only prints variable names, not secret values.

### Verify the database is connected

1. Sign up for a new account
2. You should land on the onboarding screen
3. Complete onboarding — check your Supabase dashboard (**Table Editor → profiles**)
   and confirm a row was created

---

## 14. Set Up Your First Admin Account

The admin dashboard is at `/admin`. Access requires the `is_admin = true` flag
on your profile row.

1. Sign up for an account normally at http://localhost:3000
2. Go to your Supabase dashboard → **Table Editor → profiles**
3. Find your row (match by email in **auth.users** to get the UUID)
4. Set `is_admin = true` and save

You can now visit http://localhost:3000/admin to access the full admin panel:
- Photo moderation queue
- User verification queue
- Reports queue
- User management

---

## 15. Complete `.env.local` Checklist

Before running in production confirm all of these are filled in:

```
# Required — app breaks without these
NEXT_PUBLIC_SUPABASE_URL          ✓
NEXT_PUBLIC_SUPABASE_ANON_KEY     ✓
SUPABASE_SERVICE_ROLE_KEY         ✓
NEXT_PUBLIC_APP_URL               ✓
INTERNAL_WEBHOOK_SECRET           ✓

# Required for payments
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY  ✓
STRIPE_SECRET_KEY                   ✓
STRIPE_WEBHOOK_SECRET               ✓
STRIPE_PRICE_RIDER_PLUS_MONTHLY     ✓
STRIPE_PRICE_RIDER_PLUS_YEARLY      ✓
STRIPE_PRICE_RIDER_PREMIUM_MONTHLY  ✓
STRIPE_PRICE_RIDER_PREMIUM_YEARLY   ✓

# Required for email
RESEND_API_KEY                    ✓
RESEND_FROM_EMAIL                 ✓

# Required for map features
NEXT_PUBLIC_GOOGLE_MAPS_KEY       ✓

# Required for photo moderation
SIGHTENGINE_API_USER              ✓
SIGHTENGINE_API_SECRET            ✓

# Required for web push notifications
NEXT_PUBLIC_VAPID_PUBLIC_KEY      ✓
VAPID_PRIVATE_KEY                 ✓
VAPID_SUBJECT                     ✓

# Optional
NEXT_PUBLIC_SENTRY_DSN            (recommended)
NEXT_PUBLIC_POSTHOG_KEY           (recommended)
```

---

## 16. Production Deployment Checklist

Before going live:

- [ ] Change `NEXT_PUBLIC_APP_URL` to your production domain
- [ ] Update Supabase Auth **Site URL** and **Redirect URLs** to production domain
- [ ] Create a production Stripe webhook endpoint (see section 5d)
- [ ] Switch Stripe to **live mode** and replace all `pk_test_` / `sk_test_` keys
- [ ] Verify your sending domain in Resend and update `RESEND_FROM_EMAIL`
- [ ] Restrict your Google Maps API key to your production domain
- [ ] Set `is_admin = true` on at least one admin account in production
- [ ] Run `supabase db push` against your production project to apply all migrations
- [ ] Run `npm run validate:env` in the production deployment environment; do not
  rely on `npm run build` alone for runtime env validation
- [ ] Keep `NEXT_PUBLIC_ENABLE_DEMO_LOGIN=false` for normal production; if enabled
  for review, use only a throwaway demo account because
  `NEXT_PUBLIC_DEMO_LOGIN_PASSWORD` is browser-visible
- [ ] Test the full user journey: sign up → onboard → swipe → match → message → premium

---

## Useful Commands

```bash
# Start dev server
npm run dev

# Type-check without building
npm run type-check

# Run tests
npm test

# Push DB migrations to Supabase
supabase db push

# Reset local DB (destroys all local data)
supabase db reset

# Regenerate TypeScript types from DB schema
npm run supabase:gen-types

# Forward Stripe webhooks to localhost
stripe listen --forward-to localhost:3000/api/stripe/webhook
```

⚠️ `supabase db reset` is destructive. Use it only against a local development
database, never against production.

