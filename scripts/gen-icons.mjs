import sharp from 'sharp';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');
const svg = readFileSync(resolve(root, 'web/public/logo.svg'));
const outDir = resolve(root, 'web/public/icons');

// Generate standard icons
await sharp(svg).resize(192, 192).png().toFile(resolve(outDir, 'icon-192.png'));
console.log('Created icon-192.png');

await sharp(svg).resize(512, 512).png().toFile(resolve(outDir, 'icon-512.png'));
console.log('Created icon-512.png');

// Maskable icon needs 10% safe zone padding — we add padding by placing the icon on a larger canvas
const maskableSvg = Buffer.from(`<svg viewBox="0 0 640 640" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg-m" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#9566F2"/>
      <stop offset="100%" stop-color="#1F74EC"/>
    </linearGradient>
  </defs>
  <rect width="640" height="640" fill="url(#bg-m)"/>
  <g transform="translate(64,64)">
    ${svg.toString().replace(/<svg[^>]*>/, '').replace('</svg>', '').replace(/<rect[^/]*\/>/, '')}
  </g>
</svg>`);

await sharp(maskableSvg).resize(512, 512).png().toFile(resolve(outDir, 'icon-maskable.png'));
console.log('Created icon-maskable.png');

// Favicon 32x32
await sharp(svg).resize(32, 32).png().toFile(resolve(outDir, 'favicon-32.png'));
console.log('Created favicon-32.png');

console.log('All icons generated!');
