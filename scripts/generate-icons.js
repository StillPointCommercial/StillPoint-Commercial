/**
 * Generate PWA icon PNGs from the SVG source.
 *
 * Usage:
 *   npm run generate-icons
 *
 * Prerequisites:
 *   npm install --save-dev sharp
 *
 * This reads public/icons/icon.svg and produces:
 *   - public/icons/icon-192.png  (192x192)
 *   - public/icons/icon-512.png  (512x512)
 */

const fs = require('fs')
const path = require('path')

async function main() {
  let sharp
  try {
    sharp = require('sharp')
  } catch {
    console.error(
      'Error: "sharp" is not installed.\n' +
      'Run:  npm install --save-dev sharp\n' +
      'Then: npm run generate-icons'
    )
    process.exit(1)
  }

  const svgPath = path.join(__dirname, '..', 'public', 'icons', 'icon.svg')
  const outDir  = path.join(__dirname, '..', 'public', 'icons')

  if (!fs.existsSync(svgPath)) {
    console.error(`SVG source not found at ${svgPath}`)
    process.exit(1)
  }

  const svgBuffer = fs.readFileSync(svgPath)

  const sizes = [192, 512]

  for (const size of sizes) {
    const outPath = path.join(outDir, `icon-${size}.png`)
    await sharp(svgBuffer)
      .resize(size, size)
      .png()
      .toFile(outPath)
    console.log(`Created ${outPath}`)
  }

  console.log('Done! PWA icons generated.')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
