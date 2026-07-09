// Stamp public/sw.js CACHE_VERSION with the deploy's git SHA so every deploy ships a
// byte-different service worker. The browser then detects the update and activates it, and
// the page auto-reloads into the fresh bundle (src/lib/sw-register.ts). This is the fix for
// open tabs running stale JS against a newer API after a deploy.
//
// Only runs in CI/Vercel (where the commit-SHA env var is set); local `npm run build` leaves
// the 'dev' placeholder so the working tree stays clean and no SHA is ever committed.
const fs = require('fs')
const path = require('path')

const sha = process.env.VERCEL_GIT_COMMIT_SHA || process.env.GITHUB_SHA
if (!sha) {
  console.log('[stamp-sw] no commit-SHA env var; leaving sw.js CACHE_VERSION as-is (local build)')
  process.exit(0)
}

const swPath = path.join(__dirname, '..', 'public', 'sw.js')
const src = fs.readFileSync(swPath, 'utf8')
const stamped = src.replace(/const CACHE_VERSION = '[^']*'/, `const CACHE_VERSION = '${sha.slice(0, 12)}'`)

if (stamped === src) {
  console.error('[stamp-sw] CACHE_VERSION marker not found in public/sw.js')
  process.exit(1)
}

fs.writeFileSync(swPath, stamped)
console.log(`[stamp-sw] CACHE_VERSION set to ${sha.slice(0, 12)}`)
