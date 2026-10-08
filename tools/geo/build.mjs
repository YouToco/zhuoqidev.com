// Builds the map data of the visitor map (src/pages/[...lang]/visitors/):
//   npm run geo
// -> src/data/geo/land.json       where the land is, as a 0.5° bitmap: the globe draws its dots from it.
//                                 Land only, no borders, so the globe takes no side on any border.
// -> src/data/geo/countries.json  one point per country (Natural Earth's label point), where that
//                                 country's visitors rise from the globe
// -> src/data/geo/china.json      China's provinces, Hong Kong, Macao and Taiwan, plus the nine-dash
//                                 line, simplified for the web (DataV.GeoAtlas, from AutoNavi)
//
// The sources are pinned: Natural Earth by commit, DataV.GeoAtlas by its areas_v3 path. The output is
// checked in, so building the site never needs this tool or the network.
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import mapshaper from "mapshaper";

const OUT = fileURLToPath(new URL("../../src/data/geo/", import.meta.url));
const NE = "https://raw.githubusercontent.com/nvkelso/natural-earth-vector/f1890d9f152c896d250a77557a5751a93d494776/geojson"; // v5.1.2
const DATAV = "https://geo.datav.aliyun.com/areas_v3/bound/100000_full.json";

async function get(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url}: ${res.status}`);
  return res.text();
}
const write = (name, data) => {
  const text = `${JSON.stringify(data)}\n`;
  writeFileSync(OUT + name, text);
  console.log(`${name}: ${(text.length / 1024).toFixed(1)} KB`);
};

// Land bitmap: cell (x, y) covers longitude -180 + x/2 … and latitude 90 - y/2 …; a cell is land when
// its centre is. Rows are filled scanline by scanline (even-odd over every ring), which is exact in
// this plate carrée grid and fast.
{
  const land = JSON.parse(await get(`${NE}/ne_50m_land.geojson`));
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
  write("land.json", { w: W, h: H, bits: Buffer.from(bits).toString("base64") });
}

// One point per country, keyed by the ISO 3166-1 code Cloudflare reports (ISO_A2_EH also covers the
// places Natural Earth leaves at -99, such as France and Norway).
{
  const countries = JSON.parse(await get(`${NE}/ne_50m_admin_0_countries.geojson`));
  const points = {};
  for (const { properties: p } of countries.features) {
    const code = p.ISO_A2_EH;
    if (/^[A-Z]{2}$/.test(code) && !points[code]) points[code] = [round(p.LABEL_X), round(p.LABEL_Y)];
  }
  write("countries.json", points);
}

// China: the provinces simplified with shared borders kept shared and small islands kept; the
// nine-dash line as published (simplifying would collapse its thin dashes). Rings are flat
// [lon, lat, lon, lat, …] lists with two decimals (about 1 km).
{
  const raw = await get(DATAV);
  const isDash = (f) => String(f.properties.adcode).endsWith("_JD");
  const out = await mapshaper.applyCommands("-i china.json -simplify 10% keep-shapes -o out.json format=geojson precision=0.01", {
    "china.json": raw,
  });
  const polys = (g) => (g.type === "Polygon" ? [g.coordinates] : g.coordinates).map((poly) => poly.map((ring) => ring.flat().map(round)));
  const provinces = JSON.parse(out["out.json"])
    .features.filter((f) => !isDash(f))
    .map(({ properties: p, geometry }) => ({ adcode: p.adcode, name: p.name, center: p.centroid ?? p.center, polys: polys(geometry) }));
  const dash = polys(JSON.parse(raw).features.find(isDash).geometry);
  if (provinces.length !== 34 || dash.length !== 10) throw new Error(`unexpected DataV data: ${provinces.length} provinces, ${dash.length} dashes`);
  write("china.json", { source: "DataV.GeoAtlas areas_v3 (AutoNavi)", provinces, dash });
}

function round(n) {
  return Math.round(n * 100) / 100;
}
