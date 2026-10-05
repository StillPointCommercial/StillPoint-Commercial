# StillPoint CIS / StillPoint Suite

Next.js 15 (App Router) + React 19 + TypeScript strict + Tailwind, Supabase (SSR auth + Postgres RLS), Recharts, vitest. Deployed on Vercel (git-push to main auto-deploys to stillpoint-commercial.vercel.app).

Conventions:
- No em-dashes or en-dashes in UI text, code comments, or commit messages.
- Committer identity and deploy accounts: read ~/.claude/ACCOUNTS.md before committing or deploying.
- Pushes to main require explicit user authorization (a push triggers a production deploy).
- New public Supabase tables need explicit GRANTs + RLS (see supabase/ migrations for the pattern).
- Windows/OneDrive quirk: remove .next before builds (rm -rf .next) to avoid EINVAL.

## Google access (BCM sheet round-trip)

- All Sheets/Drive traffic goes through `resolveGoogleAccess()` (src/lib/google/token.ts): the StillPoint SERVICE ACCOUNT when configured, else the signed-in user's stored OAuth token (legacy transition path). It requires a signed-in Supabase user either way.
- SA config: `GOOGLE_SA_KEY_JSON` = the whole downloaded key file pasted as-is (preferred), or `GOOGLE_SA_EMAIL` + `GOOGLE_SA_PRIVATE_KEY`. SA: `stillpoint-sheets@stillpoint-suite.iam.gserviceaccount.com` in GCP project stillpoint-suite (key creation is allowed there via a project-level override of the org policy `iam.disableServiceAccountKeyCreation`; the rest of the org still blocks keys). Sheets + Drive APIs are enabled in that project.
- Export self-heals: in SA mode, a save to a legacy copy the SA cannot see re-mints an SA-owned copy from the source and re-points the scenario.
- Service-account mode: source sheets must be shared with the SA address (Viewer suffices); scenario copies are owned by the SA and shared back to the signed-in user so they can edit them manually in their browser. This is what keeps the suite working inside customer workspaces that block third-party Drive/Sheets access (e.g. Adapta).
- Default Google sign-in requests only basic scopes (no consent screen, works under restrictive workspace policies). `/login?drive=1` requests the legacy Drive scopes and stores the grant (owner-only, for while the SA is not configured); routine logins never overwrite stored tokens.
- Saves are Supabase-first: a scenario always persists (copy_id may be null); the Sheet copy syncs when Google access exists and self-heals on a later save.

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
