import sharp from 'sharp';
import { writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const publicDir = join(__dirname, '..', 'public');

const svg = (size) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}">
  <rect width="${size}" height="${size}" fill="url(#g)" rx="${Math.round(size * 0.22)}" />
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#7C3AED" />
      <stop offset="100%" stop-color="#4C1D95" />
    </linearGradient>
  </defs>
  <text x="50%" y="55%" dominant-baseline="middle" text-anchor="middle" font-size="${Math.round(size * 0.5)}" fill="#fff" font-family="Arial, sans-serif" font-weight="900">B</text>
</svg>`;

async function gen(name, size) {
  const buffer = Buffer.from(svg(size));
  const png = await sharp(buffer).resize(size, size).png().toBuffer();
  writeFileSync(join(publicDir, name), png);
  console.log(`generated ${name} ${size}x${size}`);
}

await gen('pwa-192x192.png', 192);
await gen('pwa-512x512.png', 512);
await gen('apple-touch-icon-180x180.png', 180);
await gen('pwa-maskable-512x512.png', 512); // maskable icon for Android
