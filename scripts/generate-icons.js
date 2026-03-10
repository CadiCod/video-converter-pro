/**
 * Icon Generator — Converts master SVG to all required PNG sizes
 * Run: node scripts/generate-icons.js
 */
const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

const SVG_PATH = path.join(__dirname, '..', 'src', 'assets', 'icon.svg');
const ASSETS_DIR = path.join(__dirname, '..', 'src', 'assets');

const SIZES = [512, 256, 128, 64, 48, 32, 16];

async function generate() {
  console.log('Reading SVG from:', SVG_PATH);
  const svgBuffer = fs.readFileSync(SVG_PATH);

  for (const size of SIZES) {
    const filename = size === 512 ? 'icon.png' : `icon-${size}.png`;
    const outputPath = path.join(ASSETS_DIR, filename);

    await sharp(svgBuffer)
      .resize(size, size)
      .png({ compressionLevel: 9 })
      .toFile(outputPath);

    console.log(`  ✓ ${filename} (${size}x${size})`);
  }

  console.log('\nAll icons generated in src/assets/');
  console.log('Use icon.png (512x512) for electron-builder.');
}

generate().catch(err => {
  console.error('Icon generation failed:', err.message);
  process.exit(1);
});
