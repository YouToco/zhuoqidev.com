// IP location for the mainland line's log import (scripts/stats-cn.ts). Readers on Aliyun CDN never
// reach Cloudflare, so nobody has placed their IP for us; ip2region (github.com/lionsoul2014/ip2region,
// Apache-2.0 OR MIT) does it offline from two xdb files, one for IPv4 and one for IPv6. The workflow
// downloads them at a pinned commit and checks their hashes. Lookups happen on the runner only.
//
// xdb layout (ip2region "structure 3.0"): a 256-byte header, then a 256 x 256 vector index of
// (start, end) offsets keyed by the address's first two bytes, then sorted segments. A segment is
// start IP, end IP, data length (u16 LE) and data offset (u32 LE); IPv4 addresses are stored as
// u32 LE, IPv6 ones as 16 big-endian bytes. The data is "country|province|city|ISP|ISO code", with
// "0" for unknown parts, e.g. "中国|广东省|深圳市|中国电信|CN".
import { readFileSync } from "node:fs";
import { isIP } from "node:net";
import { join } from "node:path";

/** Same shape as Place in server/stats.ts (not imported: that file needs the Workers types). */
export type Place = { country: string; region: string; city: string };

const HEADER = 256;
const VECTOR_COLS = 256;
const VECTOR_SIZE = 8;

/** The 4 or 16 bytes of an address, or null when it is not one. */
export function ipBytes(ip: string): Buffer | null {
  const v = isIP(ip);
  if (v === 4) return Buffer.from(ip.split(".").map(Number));
  if (v !== 6) return null;
  // Expand "::" and an embedded IPv4 tail ("::ffff:1.2.3.4") into eight groups.
  let s = ip;
  const tail = /(\d+\.\d+\.\d+\.\d+)$/.exec(s);
  if (tail) {
    const b = tail[1]!.split(".").map(Number);
    s = s.slice(0, -tail[1]!.length) + `${((b[0]! << 8) | b[1]!).toString(16)}:${((b[2]! << 8) | b[3]!).toString(16)}`;
  }
  const [head, rest] = s.split("::") as [string, string?];
  const left = head ? head.split(":") : [];
  const right = rest ? rest.split(":") : [];
  const groups =
    rest === undefined
      ? left
      : [...left, ...Array.from({ length: 8 - left.length - right.length }, () => "0"), ...right];
  const out = Buffer.alloc(16);
  groups.forEach((g, i) => out.writeUInt16BE(parseInt(g, 16), i * 2));
  return out;
}

/** Looks up one address in an xdb file's bytes; "" when it is not covered. */
export function search(db: Buffer, ip: Buffer): string {
  const bytes = ip.length;
  const segment = bytes * 2 + 6;
  const idx = HEADER + (ip[0]! * VECTOR_COLS + ip[1]!) * VECTOR_SIZE;
  const sPtr = db.readUInt32LE(idx);
  const ePtr = db.readUInt32LE(idx + 4);
  if (!sPtr || !ePtr) return "";
  // Sign of (address - the bound stored at `at`).
  const cmp =
    bytes === 4
      ? (at: number) => ip.readUInt32BE(0) - db.readUInt32LE(at)
      : (at: number) => Buffer.compare(ip, db.subarray(at, at + bytes));
  let lo = 0;
  let hi = (ePtr - sPtr) / segment;
  while (lo <= hi) {
    const m = (lo + hi) >> 1;
    const p = sPtr + m * segment;
    if (cmp(p) < 0)
      hi = m - 1; // the segment starts after the address
    else if (cmp(p + bytes) > 0)
      lo = m + 1; // the segment ends before it
    else {
      const len = db.readUInt16LE(p + bytes * 2);
      const ptr = db.readUInt32LE(p + bytes * 2 + 2);
      return db.toString("utf8", ptr, ptr + len);
    }
  }
  return "";
}

// ip2region files Hong Kong, Macao and Taiwan under China; Cloudflare (and so the rest of the
// counts) reports them as places of their own.
const OWN_CODE: [RegExp, string][] = [
  [/^香港/, "HK"],
  [/^澳门/, "MO"],
  [/^台湾/, "TW"],
];

/** Turns an ip2region data string into the same shape the beacon stores. */
export function placeFrom(data: string): Place {
  const [, province = "0", city = "0", , iso = "0"] = data.split("|");
  const part = (s: string) => (s === "0" ? "" : s);
  const country = /^[A-Z]{2}$/.test(iso) ? iso : "XX";
  const own = OWN_CODE.find(([re]) => re.test(province));
  if (country === "CN" && own) return { country: own[1], region: "", city: part(city) };
  return { country, region: part(province), city: part(city) };
}

/** Loads ip2region_v4.xdb and ip2region_v6.xdb from a directory; returns a lookup function. */
export function openIp2region(dir: string): (ip: string) => Place {
  const v4 = readFileSync(join(dir, "ip2region_v4.xdb"));
  const v6 = readFileSync(join(dir, "ip2region_v6.xdb"));
  return (ip) => {
    const b = ipBytes(ip);
    if (!b) return { country: "XX", region: "", city: "" };
    const data = search(b.length === 4 ? v4 : v6, b);
    return data ? placeFrom(data) : { country: "XX", region: "", city: "" };
  };
}
