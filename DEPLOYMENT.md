# StillPoint CIS — Deployment Guide

## Prerequisites

- **Node.js** 18.17 or later
- **Supabase** account (free tier works) — [supabase.com](https://supabase.com)
- **Anthropic API key** — [console.anthropic.com](https://console.anthropic.com)
- **Vercel** account (recommended for hosting) — [vercel.com](https://vercel.com)
- **Resend** account (for email notifications) — [resend.com](https://resend.com)

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Supabase project URL (Settings > API) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | Supabase anon/public key (Settings > API) |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Supabase service role key (Settings > API) — keep secret |
| `ANTHROPIC_API_KEY` | Yes | Anthropic API key for AI features |
| `RESEND_API_KEY` | Optional | Resend API key for email notifications |
| `CRON_SECRET` | Optional | Secret token to protect cron endpoint from unauthorized calls |

## Supabase Setup

1. Create a new project at [supabase.com](https://supabase.com/dashboard)
2. Go to the SQL Editor in your Supabase dashboard
3. Run the schema file: copy the contents of `supabase/schema.sql` and execute it
4. Go to **Settings > API** and copy your project URL and keys
5. Enable **Row Level Security** if not already enabled by the schema
6. Under **Authentication > Providers**, enable Email auth (enabled by default)

## Local Development

```bash
# 1. Clone the repository
git clone <repo-url>
cd stillpoint-cis

# 2. Install dependencies
npm install

# 3. Create environment file
cp .env.example .env.local
# Edit .env.local with your actual keys (see table above)

# 4. Generate PWA icons (one-time)
npm install --save-dev sharp
npm run generate-icons

# 5. Start dev server
npm run dev
```

The app will be available at `http://localhost:3000`.

## PWA Icon Generation

The app ships with an SVG icon at `public/icons/icon.svg`. PWA requires PNG icons for full compatibility. To generate them:

```bash
npm install --save-dev sharp
npm run generate-icons
```

This creates `icon-192.png` and `icon-512.png` in `public/icons/`. These PNGs are gitignored — generate them as part of your build or commit them manually.

## Vercel Deployment

1. Push your code to a GitHub repository
2. Go to [vercel.com](https://vercel.com) and import the repository
3. Add all environment variables in the Vercel project settings (Settings > Environment Variables)
4. Deploy — Vercel will auto-detect the Next.js framework
5. Set up a custom domain if desired (Settings > Domains)

### Cron Job (optional)

If the app uses scheduled tasks (e.g., daily digest emails), set up a Vercel Cron Job:

1. Add a `CRON_SECRET` environment variable in Vercel
2. The cron configuration is in `vercel.json` (if present) or can be added:
   ```json
   {
     "crons": [
       {
         "path": "/api/cron/daily-digest?secret=${CRON_SECRET}",
         "schedule": "0 8 * * 1-5"
       }
     ]
   }
   ```

## Post-Deployment Checklist

- [ ] **Authentication**: Register a test account and verify login/logout works
- [ ] **CRUD operations**: Create, read, update, and delete a contact and a deal
- [ ] **AI features**: Test AI-powered features (requires valid ANTHROPIC_API_KEY)
- [ ] **PWA install**: Visit the deployed URL on mobile, verify "Add to Home Screen" works
- [ ] **Offline support**: Check that the service worker caches the app shell
- [ ] **Cron jobs**: If configured, verify the cron endpoint returns 200 with the correct secret
- [ ] **Email**: If Resend is configured, trigger a test email notification
- [ ] **RLS policies**: Verify that users can only see their own data in Supabase
