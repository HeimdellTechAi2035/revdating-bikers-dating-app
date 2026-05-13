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
There are 22 migration files numbered 001–022.

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
```

All files are in the `supabase/migrations/` folder.

> If you get a "type already exists" or "table already exists" error on an early
> migration, run the migrations from where the error stopped — the earlier ones
> ran fine.

### 4d. Create storage buckets

Go to **Storage** in your Supabase dashboard and create two buckets:

**Bucket 1 — `profile-photos`**
- Click **New bucket**
- Name: `profile-photos`
- Public bucket: **ON** (tick the checkbox)
- File size limit: `10 MB`
- Allowed MIME types: `image/jpeg, image/png, image/webp`
- Click **Create bucket**

**Bucket 2 — `verifications`**
- Click **New bucket**
- Name: `verifications`
- Public bucket: **OFF** (private — signed URLs only)
- File size limit: `10 MB`
- Allowed MIME types: `image/jpeg, image/png, image/webp`
- Click **Create bucket**

**Storage RLS policies**

After creating the buckets, go to **Storage → Policies** and add these policies:

For `profile-photos`:
- **SELECT** (read): Allow public — policy: `true`
- **INSERT**: Allow authenticated users to upload to their own folder:
  ```sql
  (auth.uid()::text = (storage.foldername(name))[1])
  ```
- **DELETE**: Same condition as INSERT

For `verifications`:
- **INSERT**: Authenticated users can upload to their own selfies folder:
  ```sql
  (auth.uid()::text = (storage.foldername(name))[2])
  ```
- **SELECT**: Service role only (the app uses signed URLs via the admin client)

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

## 7. Google Maps — Ride Date Planning

### 7a. Create a project and enable APIs

1. Go to https://console.cloud.google.com
2. Create a new project (or use an existing one)
3. Go to **APIs & Services → Enable APIs and Services**
4. Search and enable each of these three APIs:
   - **Maps JavaScript API**
   - **Places API**
   - **Maps Static API**

### 7b. Create an API key

1. Go to **APIs & Services → Credentials → Create credentials → API key**
2. Copy the key and add to `.env.local`:

```
NEXT_PUBLIC_GOOGLE_MAPS_KEY=AIza...
```

### 7c. Restrict the key (recommended)

- Under **Application restrictions**, select **HTTP referrers** and add your domain
- Under **API restrictions**, select **Restrict key** and select the three APIs above

---

## 8. Sightengine — Photo Moderation & Selfie Face Detection

### 8a. Create an account

Sign up at https://sightengine.com. The free tier allows 2,000 operations/month.

### 8b. Get your API credentials

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

## 9. OneSignal — Push Notifications

### 9a. Create an app

1. Go to https://onesignal.com and create a new app
2. Select **Web Push** as the platform
3. Set your site URL and default icon

### 9b. Get your credentials

Go to **Settings → Keys & IDs**:

```
NEXT_PUBLIC_ONESIGNAL_APP_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
ONESIGNAL_REST_API_KEY=your-rest-api-key
```

> Without these keys push notifications are silently skipped. The app works fully
> without them — users just won't receive push alerts.

---

## 10. Sentry — Error Tracking (optional but recommended)

1. Sign up at https://sentry.io and create a **Next.js** project
2. Get your DSN from **Settings → Projects → [your project] → Client Keys**

```
NEXT_PUBLIC_SENTRY_DSN=https://...@sentry.io/...
SENTRY_AUTH_TOKEN=sntrys_...
SENTRY_ORG=your-org-slug
SENTRY_PROJECT=REVdating
```

---

## 11. PostHog — Product Analytics (optional)

1. Sign up at https://posthog.com and create a project
2. Copy the **Project API key** from your project settings

```
NEXT_PUBLIC_POSTHOG_KEY=phc_...
NEXT_PUBLIC_POSTHOG_HOST=https://app.posthog.com
```

---

## 12. Run the App

```bash
npm run dev
```

Open http://localhost:3000. You should see the REVdating landing/login page.

### Verify the database is connected

1. Sign up for a new account
2. You should land on the onboarding screen
3. Complete onboarding — check your Supabase dashboard (**Table Editor → profiles**)
   and confirm a row was created

---

## 13. Set Up Your First Admin Account

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

## 14. Complete `.env.local` Checklist

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

# Required for push notifications
NEXT_PUBLIC_ONESIGNAL_APP_ID      ✓
ONESIGNAL_REST_API_KEY            ✓

# Optional
NEXT_PUBLIC_SENTRY_DSN            (recommended)
NEXT_PUBLIC_POSTHOG_KEY           (recommended)
```

---

## 15. Production Deployment Checklist

Before going live:

- [ ] Change `NEXT_PUBLIC_APP_URL` to your production domain
- [ ] Update Supabase Auth **Site URL** and **Redirect URLs** to production domain
- [ ] Create a production Stripe webhook endpoint (see section 5d)
- [ ] Switch Stripe to **live mode** and replace all `pk_test_` / `sk_test_` keys
- [ ] Verify your sending domain in Resend and update `RESEND_FROM_EMAIL`
- [ ] Restrict your Google Maps API key to your production domain
- [ ] Set `is_admin = true` on at least one admin account in production
- [ ] Run `supabase db push` against your production project to apply all migrations
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

