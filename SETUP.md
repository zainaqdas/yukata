# 🚀 PatronHub — Setup & Deployment Guide

A private, members-only content platform for your Patreon community.  
Automatically syncs your Patreon posts and serves video via Mux HLS streams — no more laggy Patreon UI.

---

## 📋 Prerequisites

- A **GitHub account** (you already have one)
- A **Vercel account** (free tier works — [sign up](https://vercel.com))
- A **PostgreSQL database** (see Step 1)
- An **email provider** for magic-link sign-ins (see Step 2)
- Your **Patreon `session_id` cookie** (see Step 3)

---

## Step 1: Create a PostgreSQL Database

Pick one of these providers:

| Provider | Free Tier | Best For |
|---|---|---|
| **[Neon](https://neon.tech)** | ✅ 0.5 GB, serverless | Recommended — branches, good Prisma support |
| **[Supabase](https://supabase.com)** | ✅ 500 MB | If you also want auth/storage |
| **[Railway](https://railway.app)** | ❌ Starts at $5/mo | Simple provisioning |

After creating the database, copy your connection string. It looks like:

```
postgresql://user:password@ep-cool-name.us-east-2.aws.neon.tech/patronhub?sslmode=require
```

> 💡 **Save this** — you'll need it for both Vercel env vars and running migrations.

---

## Step 2: Set Up Email for Magic Links

Auth.js sends magic-link sign-in emails via SMTP. Free tiers:

| Provider | Free Tier | Setup Time |
|---|---|---|
| **[Resend](https://resend.com)** | 100 emails/day | ~2 min |
| **[SendGrid](https://sendgrid.com)** | 100 emails/day | ~5 min |
| **[Brevo](https://brevo.com)** | 300 emails/day | ~5 min |

After signing up, get your SMTP credentials. Example (Resend):

```
EMAIL_SERVER="smtp://resend:re_xxxxxxx@smtp.resend.com:587"
EMAIL_FROM="noreply@yourdomain.com"
```

---

## Step 3: Get Your Patreon `session_id` Cookie

This is how the app imports your posts — it uses the same cookie your browser uses.

1. Open **Chrome** or **Firefox**
2. Go to [patreon.com](https://patreon.com) and **log in**
3. Open DevTools (`F12` → **Application** tab → **Cookies** → `patreon.com`)
4. Find the row named `session_id` and **copy its value**
5. **(Optional)** Also copy `__cf_bm` — helps bypass Cloudflare bot detection

> ⚠️ This cookie expires periodically. When sync stops working, repeat this step and paste the new cookie in the admin dashboard.

---

## Step 4: Deploy to Vercel

1. Go to [vercel.com/new](https://vercel.com/new)
2. Click **Import** → select `zainaqdas/yukata`
3. Vercel auto-detects Next.js — no framework changes needed
4. Expand **Environment Variables** and add these:

| Key | Value |
|---|---|
| `DATABASE_URL` | Your PostgreSQL connection string from Step 1 |
| `AUTH_SECRET` | Run `openssl rand -hex 32` in terminal, paste result |
| `AUTH_URL` | `https://your-app-name.vercel.app` (update after deploy) |
| `EMAIL_SERVER` | SMTP string from Step 2 |
| `EMAIL_FROM` | `noreply@yourdomain.com` |
| `CRON_SECRET` | Run `openssl rand -hex 32` again, paste result |
| `PATREON_CF_BM_COOKIE` | (optional) Cloudflare cookie from Step 3 |

5. Click **Deploy** 🚀

After deployment, Vercel gives you a URL like `https://patron-hub-abc123.vercel.app`.

---

## Step 5: Run Database Migrations

Run this from your terminal (replace the URL with your real one):

```bash
cd patron-hub
DATABASE_URL="postgresql://user:pass@host/db?sslmode=require" \
  npx prisma migrate deploy
```

This creates all the tables (User, InviteCode, Post, Media, SyncState, etc.).

---

## Step 6: Seed the First Invite Code

Since invite codes are required to sign up, insert one directly into the database:

```sql
INSERT INTO "InviteCode" (id, code, "maxUses", "isActive", "createdAt", "updatedAt")
VALUES (gen_random_uuid(), 'SETUP-2026', 1, true, NOW(), NOW());
```

> Run this in your database provider's SQL console (Neon, Supabase, Railway — all have one).

---

## Step 7: Sign In & Promote to Admin

1. Go to `https://your-app.vercel.app/login`
2. Enter your email + invite code `SETUP-2026`
3. Check your inbox for the magic link → click it → you're signed in
4. Promote yourself to admin via SQL:

```sql
UPDATE "User" SET role = 'ADMIN' WHERE email = 'your@email.com';
```

5. Refresh the page — you should now see the **Admin** link in the navbar

---

## Step 8: Connect Patreon Sync

1. Go to `/admin`
2. Paste your `session_id` cookie (from Step 3) into the **Patreon Session** field
3. Click **Save**
4. Click **Sync Now**
5. The sync engine will:
   - Fetch all your Patreon posts
   - Extract thumbnails, embeds, and content
   - Auto-detect Mux HLS video URLs from video posts
   - Store everything in your database

✅ Your content is now live on your private site.

---

## Step 9: Invite Your Members

From the admin dashboard (`/admin`):

1. Click **Generate Invite Code**
2. Set max uses (e.g., `50` for 50 members)
3. Add a note like "January 2026 — Gold tier"
4. Share the code with your Patreon members
5. They sign up at `/login` with email + invite code
6. Once used, `currentUses` increments — you can track who joined

---

## 🔄 Ongoing: Keeping Content Fresh

The Vercel cron jobs (set in `vercel.json`) handle this automatically:

- **Every 15 min** → Syncs new posts from Patreon
- **Every hour** → Checks for expiring HLS video URLs

You can also trigger a manual sync anytime from `/admin` → **Sync Now**.

Mux HLS URLs expire after ~24 hours. The cron job alerts you when URLs are approaching expiry. When that happens, re-sync or paste a fresh `session_id` and the HLS URLs will refresh.

---

## 🔧 Troubleshooting

| Problem | Fix |
|---|---|
| "Magic link email not arriving" | Check spam folder. Verify `EMAIL_SERVER` in Vercel env vars. Test with Resend's dashboard. |
| "Sync fails / session expired" | Your `session_id` cookie expired. Log into Patreon again, copy the new cookie, paste in `/admin`. |
| "Cloudflare CAPTCHA" | Add `__cf_bm` cookie in `/admin` or set `PATREON_CF_BM_COOKIE` env var. |
| "Build fails" | Check Vercel build logs. Make sure `DATABASE_URL` is set and `prisma generate` succeeds. |
| "Database migration fails" | Make sure your IP is allowed in the database provider's firewall settings (Neon/Supabase default to allow all). |
| "Videos not playing" | The Mux HLS URL may have expired. Go to `/admin` → **Sync Now** to refresh. |

---

## 📁 Project Structure

```
patron-hub/
├── prisma/
│   └── schema.prisma          # Database models (User, Post, Media, SyncState, etc.)
├── src/
│   ├── app/
│   │   ├── (auth)/             # Protected routes (posts, gallery, search, admin)
│   │   ├── api/                # API routes (auth, posts, sync, invites, hls, session, cron)
│   │   ├── login/              # Login page
│   │   ├── layout.tsx          # Root layout
│   │   └── page.tsx            # Landing page
│   ├── components/             # React components (Navbar, VideoPlayer, PostCard, etc.)
│   ├── lib/                    # Core logic (auth.ts, prisma.ts, patreon.ts, hls.ts, invites.ts)
│   └── middleware.ts           # Auth.js middleware (protects routes)
├── .env.example                # Environment variables template
├── vercel.json                 # Vercel config with cron jobs
└── SETUP.md                    # This file
```

---

## 🔐 Security Notes

- **Never commit `.env`** — it's in `.gitignore`
- **Rotate `AUTH_SECRET` and `CRON_SECRET`** periodically
- **The Patreon `session_id` is stored in your database** — it gives full access to your Patreon account. Keep your database credentials secure.
- **If you ever shared a GitHub personal access token publicly**, revoke it immediately at [GitHub → Settings → Tokens](https://github.com/settings/tokens) and generate a new one

---

## 📊 Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16 (App Router) |
| Language | TypeScript |
| Database | PostgreSQL + Prisma ORM |
| Auth | Auth.js v5 (magic links) |
| Email | Nodemailer + SMTP |
| Video | video.js + hls.js + Mux HLS |
| Styling | Tailwind CSS 4 |
| Hosting | Vercel (with cron jobs) |
