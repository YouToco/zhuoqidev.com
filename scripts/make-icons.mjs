// Regenerates the PNG/ICO favicons in public/ from public/favicon.svg.
// Run after editing the SVG: node scripts/make-icons.mjs
import { readFile, writeFile } from "node:fs/promises";
import sharp from "sharp";

const svg = await readFile(new URL("../public/favicon.svg", import.meta.url));
const out = (name) => new URL(`../public/${name}`, import.meta.url);
const png = (size) => sharp(svg, { density: 384 }).resize(size, size).png().toBuffer();

for (const [name, size] of [
  ["favicon-16x16.png", 16],
  ["favicon-32x32.png", 32],
  ["apple-touch-icon.png", 180],
  ["android-chrome-192x192.png", 192],
  ["android-chrome-512x512.png", 512],
]) {
  await writeFile(out(name), await png(size));
}

// An .ico file may hold a PNG payload: 6-byte header + one 16-byte directory entry.
const ico32 = await png(32);
const header = Buffer.alloc(22);
header.writeUInt16LE(0, 0);
header.writeUInt16LE(1, 2);
header.writeUInt16LE(1, 4);
header.writeUInt8(32, 6);
header.writeUInt8(32, 7);
header.writeUInt16LE(1, 10);
header.writeUInt16LE(32, 12);
header.writeUInt32LE(ico32.length, 14);
header.writeUInt32LE(22, 18);
await writeFile(out("favicon.ico"), Buffer.concat([header, ico32]));

await writeFile(
  out("site.webmanifest"),
  JSON.stringify(
    {
      name: "卓琪的开发笔记 · ZhuoQi Dev",
      short_name: "ZhuoQi Dev",
      icons: [
        { src: "/android-chrome-192x192.png", sizes: "192x192", type: "image/png" },
        { src: "/android-chrome-512x512.png", sizes: "512x512", type: "image/png" },
      ],
      theme_color: "#fbf8f1",
      background_color: "#fbf8f1",
      display: "standalone",
    },
    null,
    2,
  ) + "\n",
);
console.log("icons written");
