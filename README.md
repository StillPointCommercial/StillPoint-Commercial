# StillPoint Suite

A multi-tool platform for StillPoint clients. One sign-in, a tile launcher, and per-user access to each tool. Built on Next.js 15 (App Router), React 19, TypeScript, Tailwind, and a single Supabase project.

## Tools

- **Commercial Intelligence System** (`/tools/cis`) — the CRM: contacts, pipeline, offers, year plan, import. (Existing app, kept in its warm theme.)
- **Business Case Model** (`/tools/business-case-model`) — interactive revenue scenarios, land-and-expand value build, product mix & margin, a back-calculated lead funnel, and an outcome-vs-plan view, with savable named scenarios and Excel import. Cool minimalist "suite" theme.
- **Admin console** (`/admin`, owner only) — users, per-user tile access, a read-only scenario viewer, and a "viewing as" preview.

The launcher lives at `/`. Each tool route is guarded server-side; a client only sees and can open the tiles the owner has granted.

## Local development

```bash
npm install
npm run dev        # http://localhost:3000
npm test           # vitest — Business Case Model math
npm run build      # production build
```

Windows + OneDrive note: if `npm run dev` throws `EINVAL ... readlink .next/...`, delete the `.next` folder once (it was left by a prior `next build`) and start dev again. `next dev` and `next build` keep separate manifests and can clash on OneDrive.

## Environment (`.env.local`)

```
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
ANTHROPIC_API_KEY=...
# CRM extras: RESEND_API_KEY, CRON_SECRET, DIGEST_RECIPIENT_EMAIL, ANTHROPIC_MODEL, EMAIL_FROM, NEXT_PUBLIC_APP_URL
```

## Database

One Supabase project (`hrrelonnrjupxjsdvxxd`, "Commercial Intelligence System (CIS)"). Suite tables are added by `supabase/migrations/0002_suite.sql` (already applied):

- `profiles` (role: client | owner), `allowed_emails` (invite allowlist)
- `tools`, `tool_access` (per-user tile grants)
- `bcm_datasets`, `bcm_scenarios` (Business Case Model data)

Every table has RLS: a user sees only their own rows; the owner can read all suite data. The CRM tables are untouched and stay private per user. A trigger provisions an allowlisted user (profile + default tiles) on first sign-in; the `/auth/callback` route rejects anyone not on the allowlist.

To invite a client: add their email via the Admin console (or `insert into allowed_emails`), then grant tiles in Admin → Tile access.

## Auth

Magic-link (email OTP). The owner (`wouter.dirks@stillpointcommercial.com`) is seeded with `role = owner` and access to every tool.

## Deploy (Vercel)

1. Import this repo into Vercel (framework auto-detected as Next.js).
2. Add the env vars above in Vercel → Project → Settings → Environment Variables.
3. In Supabase → Authentication → URL Configuration:
   - **Site URL** = your production URL (e.g. `https://stillpoint-suite.vercel.app`)
   - **Redirect URLs** = add `https://<your-domain>/auth/callback` (and `http://localhost:3000/auth/callback` for local).
4. Deploy. Open the URL, sign in with an allowlisted email.
