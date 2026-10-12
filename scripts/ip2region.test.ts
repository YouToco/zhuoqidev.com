import assert from "node:assert/strict";
import { test } from "node:test";
import { ipBytes, placeFrom, search } from "./ip2region.ts";

/** A minimal xdb file (layout in ip2region.ts) holding the given sorted, non-overlapping segments. */
function xdb(segments: [string, string, string][]): Buffer {
  const bytes = ipBytes(segments[0]![0])!.length;
  const size = bytes * 2 + 6;
  const vectorEnd = 256 + 256 * 256 * 8;
  const data = segments.map(([, , d]) => Buffer.from(d));
  const dataStart = vectorEnd;
  const segStart = dataStart + data.reduce((n, d) => n + d.length, 0);
  const db = Buffer.alloc(segStart + segments.length * size);
  let ptr = dataStart;
  segments.forEach(([start, end], i) => {
    const s = ipBytes(start)!;
    const e = ipBytes(end)!;
    const at = segStart + i * size;
    if (bytes === 4) {
      db.writeUInt32LE(s.readUInt32BE(0), at);
      db.writeUInt32LE(e.readUInt32BE(0), at + 4);
    } else {
      s.copy(db, at);
      e.copy(db, at + 16);
    }
    db.writeUInt16LE(data[i]!.length, at + bytes * 2);
    db.writeUInt32LE(ptr, at + bytes * 2 + 2);
    data[i]!.copy(db, ptr);
    ptr += data[i]!.length;
    // Point every vector cell this segment touches at it (a test file has few segments per cell).
    for (let a = s[0]!; a <= e[0]!; a++)
      for (let b = a === s[0] ? s[1]! : 0; b <= (a === e[0] ? e[1]! : 255); b++) {
        const cell = 256 + (a * 256 + b) * 8;
        if (!db.readUInt32LE(cell)) db.writeUInt32LE(at, cell);
        db.writeUInt32LE(at, cell + 4);
      }
  });
  return db;
}

test("parses IPv4 and IPv6 addresses", () => {
  assert.deepEqual([...ipBytes("1.2.3.4")!], [1, 2, 3, 4]);
  assert.equal(ipBytes("2001:db8::1")!.toString("hex"), "20010db8000000000000000000000001");
  assert.equal(ipBytes("::ffff:1.2.3.4")!.toString("hex"), "00000000000000000000ffff01020304");
  assert.equal(ipBytes("::")!.toString("hex"), "0".repeat(32));
  assert.equal(ipBytes("-"), null);
});

test("finds the segment holding an address", () => {
  const v4 = xdb([
    ["1.0.0.0", "1.0.0.255", "中国|广东省|深圳市|中国电信|CN"],
    ["1.0.1.0", "1.0.3.255", "United States|California|San Jose|0|US"],
  ]);
  assert.equal(search(v4, ipBytes("1.0.0.0")!), "中国|广东省|深圳市|中国电信|CN");
  assert.equal(search(v4, ipBytes("1.0.0.255")!), "中国|广东省|深圳市|中国电信|CN");
  assert.equal(search(v4, ipBytes("1.0.2.9")!), "United States|California|San Jose|0|US");
  assert.equal(search(v4, ipBytes("9.9.9.9")!), "");
  const v6 = xdb([
    ["2001:db8::", "2001:db8::ffff", "中国|上海|上海市|0|CN"],
    ["2001:db8::1:0", "2001:db8::ffff:ffff", "Japan|Tokyo|0|0|JP"],
  ]);
  assert.equal(search(v6, ipBytes("2001:db8::42")!), "中国|上海|上海市|0|CN");
  assert.equal(search(v6, ipBytes("2001:db8::2:1")!), "Japan|Tokyo|0|0|JP");
  assert.equal(search(v6, ipBytes("2400::1")!), "");
});

test("turns ip2region data into places like Cloudflare's", () => {
  assert.deepEqual(placeFrom("中国|广东省|深圳市|中国电信|CN"), { country: "CN", region: "广东省", city: "深圳市" });
  assert.deepEqual(placeFrom("中国|香港特别行政区|0|0|CN"), { country: "HK", region: "", city: "" });
  assert.deepEqual(placeFrom("中国|台湾省|台北市|0|CN"), { country: "TW", region: "", city: "台北市" });
  assert.deepEqual(placeFrom("中国|澳门特别行政区|0|0|CN"), { country: "MO", region: "", city: "" });
  assert.deepEqual(placeFrom("0|0|0|内网IP|0"), { country: "XX", region: "", city: "" });
});
