# StillPoint CIS / StillPoint Suite

Next.js 15 (App Router) + React 19 + TypeScript strict + Tailwind, Supabase (SSR auth + Postgres RLS), Recharts, vitest. Deployed on Vercel (git-push to main auto-deploys to stillpoint-commercial.vercel.app).

Conventions:
- No em-dashes or en-dashes in UI text, code comments, or commit messages.
- Committer identity and deploy accounts: read ~/.claude/ACCOUNTS.md before committing or deploying.
- Pushes to main require explicit user authorization (a push triggers a production deploy).
- New public Supabase tables need explicit GRANTs + RLS (see supabase/ migrations for the pattern).
- Windows/OneDrive quirk: remove .next before builds (rm -rf .next) to avoid EINVAL.

## Health Stack

- typecheck: npx tsc --noEmit
- test: npx vitest run
- lint: npm run lint
- deadcode: skipped (knip not installed)
- shell: skipped (shellcheck not installed)

Accepted audit residual: 2 moderate advisories against the postcss copy pinned
inside next's own dependency tree (build-time only; npm's proposed "fix" is a
downgrade to next 9). Revisit on the next Next.js upgrade.

## StillPoint Suite app switcher (cross-app navigation)

- `src/components/suite/app-switcher.tsx` ('use client') + `src/components/suite/suite-apps.ts` (pure registry, safe in Server Components) are verbatim copies of the canonical suite files shared by all six StillPoint apps. Mounted owner-only in `suite-header.tsx` (actions area) and in `layout/sidebar.tsx` (via `AppShell isOwner`, set in `tools/cis/layout.tsx`). The launcher (`app/(app)/page.tsx`) also shows an owner-only "Other StillPoint apps" tile section built from `SUITE_APPS`.
- Clients (role `client`) must never see the switcher or the external tiles; keep every mount behind the owner check.
- The app list + subdomain map live in `~/.claude/PROJECTS.md` (section "StillPoint Suite"). When an app is added/renamed/re-homed: update PROJECTS.md first, then every copy of `suite-apps.ts` in every app. Do not fork the component locally.
- Links resolve to `*.stillpointcommercial.com` when the page itself is served from a suite subdomain (client: `window.location.hostname`; server: the `host` header), else to the `*.vercel.app` URLs. Keeps Supabase auth origins consistent; nothing breaks before DNS is live.
