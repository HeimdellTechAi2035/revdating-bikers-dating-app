/**
 * generate-icons.js
 *
 * Generates all required PWA + Google Play icon PNGs from the SVG source.
 *
 * Run ONCE after setting up the project:
 *   node scripts/generate-icons.js
 *
 * Requires: sharp  (already installed as dev dependency)
 */

const sharp = require('sharp');
const path  = require('path');
const fs    = require('fs');

const SRC   = path.join(__dirname, '../public/icon.svg');
const DEST  = path.join(__dirname, '../public/icons');

if (!fs.existsSync(DEST)) fs.mkdirSync(DEST, { recursive: true });

const SIZES = [48, 72, 96, 128, 144, 152, 167, 180, 192, 256, 384, 512];

// Maskable icons need 20% safe-zone padding (Google Play requirement)
const MASKABLE = [192, 512];

(async () => {
  const svg = fs.readFileSync(SRC);

  for (const size of SIZES) {
    const dest = path.join(DEST, `icon-${size}x${size}.png`);
    await sharp(svg).resize(size, size).png().toFile(dest);
    console.log(`✓ icon-${size}x${size}.png`);
  }

  // Maskable variants — shrink the graphic to 60% so it sits in the safe zone
  for (const size of MASKABLE) {
    const inner   = Math.round(size * 0.6);
    const padding = Math.round((size - inner) / 2);

    const resized = await sharp(svg)
      .resize(inner, inner)
      .png()
      .toBuffer();

    const dest = path.join(DEST, `icon-${size}x${size}-maskable.png`);
    await sharp({
      create: {
        width:      size,
        height:     size,
        channels:   4,
        background: { r: 10, g: 10, b: 10, alpha: 1 },  // #0A0A0A brand dark
      },
    })
      .composite([{ input: resized, top: padding, left: padding }])
      .png()
      .toFile(dest);

    console.log(`✓ icon-${size}x${size}-maskable.png`);
  }

  // Apple splash screens (simple square icons work for these)
  const apple = path.join(DEST, 'apple-touch-icon.png');
  await sharp(svg).resize(180, 180).png().toFile(apple);
  console.log('✓ apple-touch-icon.png');

  // Favicon
  const favicon = path.join(__dirname, '../public/favicon.png');
  await sharp(svg).resize(32, 32).png().toFile(favicon);
  console.log('✓ favicon.png (32x32)');

  console.log('\nAll icons generated successfully!');
})().catch(console.error);
