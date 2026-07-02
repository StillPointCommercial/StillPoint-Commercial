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
- lint: skipped (eslint not installed; `next lint` would prompt interactively)
- deadcode: skipped (knip not installed)
- shell: skipped (shellcheck not installed)
