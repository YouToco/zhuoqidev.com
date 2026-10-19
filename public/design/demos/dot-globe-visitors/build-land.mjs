// Rebuilds GEO.land in geo.js: a 0.5-degree land bitmap from any land polygons in GeoJSON.
//
//   1. Download ne_50m_land.geojson from Natural Earth (public domain), e.g. from
//      https://github.com/nvkelso/natural-earth-vector/tree/master/geojson
//   2. node build-land.mjs ne_50m_land.geojson > land.json
//   3. Paste the output after `land:` in geo.js.
//
// Cell (x, y) covers longitude -180 + x / 2 … and latitude 90 - y / 2 …; a cell is land when its centre
// is. Each row is filled as a scanline (even-odd over every ring), which is exact in this plate carrée
// grid and takes well under a second.
import { readFileSync } from "node:fs";

const file = process.argv[2];
if (!file) {
  console.error("usage: node build-land.mjs <land.geojson>");
  process.exit(1);
}
const land = JSON.parse(readFileSync(file, "utf8"));
const W = 720;
const H = 360;
const bits = new Uint8Array((W * H) / 8);
const rings = land.features.flatMap((f) =>
  f.geometry.type === "Polygon" ? f.geometry.coordinates : f.geometry.coordinates.flat(),
);
for (let y = 0; y < H; y++) {
  const lat = 90 - (y + 0.5) / 2;
  const xs = [];
  for (const ring of rings) {
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const [x1, y1] = ring[i];
      const [x2, y2] = ring[j];
      if (y1 > lat !== y2 > lat) xs.push(x1 + ((lat - y1) / (y2 - y1)) * (x2 - x1));
    }
  }
  xs.sort((a, b) => a - b);
  for (let k = 0; k + 1 < xs.length; k += 2) {
    for (let x = Math.max(0, Math.ceil((xs[k] + 180) * 2 - 0.5)); x < W && (x + 0.5) / 2 - 180 < xs[k + 1]; x++) {
      const n = y * W + x;
      bits[n >> 3] |= 1 << (n & 7);
    }
  }
}
process.stdout.write(`${JSON.stringify({ w: W, h: H, bits: Buffer.from(bits).toString("base64") })}\n`);
