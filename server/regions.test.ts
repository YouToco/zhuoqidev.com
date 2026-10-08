import assert from "node:assert/strict";
import { test } from "node:test";
import { PROVINCES, provinceOf } from "./regions.ts";

test("every shape on the China map has a name", () => {
  assert.equal(PROVINCES.length, 34);
  assert.equal(new Set(PROVINCES.map((p) => p.adcode)).size, 34);
});

test("Chinese regions in the spellings IP location data uses", () => {
  const cases: [string, number][] = [
    ["Guangdong", 440000],
    ["Guangdong Sheng", 440000],
    ["Beijing Shi", 110000],
    ["Inner Mongolia", 150000],
    ["Nei Mongol Zizhiqu", 150000],
    ["Tibet", 540000],
    ["Xizang Autonomous Region", 540000],
    ["Xinjiang Uygur Zizhiqu", 650000],
    ["Guangxi Zhuangzu Zizhiqu", 450000],
    ["Ningxia Hui Autonomous Region", 640000],
    ["Shaanxi", 610000],
    ["Shanxi", 140000],
    ["广东省", 440000],
    ["新疆维吾尔自治区", 650000],
  ];
  for (const [region, code] of cases) assert.equal(provinceOf("CN", region)?.adcode, code, region);
});

test("Hong Kong, Macao and Taiwan come as countries", () => {
  assert.equal(provinceOf("HK", "")?.adcode, 810000);
  assert.equal(provinceOf("MO", "Macau")?.adcode, 820000);
  assert.equal(provinceOf("TW", "Taipei City")?.adcode, 710000);
});

test("outside China, or no region: not on the map", () => {
  assert.equal(provinceOf("CN", ""), null);
  assert.equal(provinceOf("CN", "Atlantis"), null);
  assert.equal(provinceOf("US", "Guangdong"), null);
  assert.equal(provinceOf("SG", ""), null);
});
