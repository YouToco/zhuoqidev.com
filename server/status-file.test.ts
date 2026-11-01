import assert from "node:assert/strict";
import { test } from "node:test";
import { dayOf, editionOf, snapshotName } from "./status-file.ts";

test("edition counts the minutes of the day from 1", () => {
  assert.equal(editionOf(new Date(2026, 10, 1, 0, 0)), 1);
  assert.equal(editionOf(new Date(2026, 10, 1, 0, 59)), 60);
  assert.equal(editionOf(new Date(2026, 10, 1, 23, 59)), 1440);
});

test("the day is padded YYYY-MM-DD in the reader's clock", () => {
  assert.equal(dayOf(new Date(2026, 10, 1, 0, 59)), "2026-11-01");
  assert.equal(dayOf(new Date(2026, 0, 9, 23, 59)), "2026-01-09");
});

test("file names carry the date and edition the page shows, per language", () => {
  assert.equal(snapshotName("zh", "2026-11-01", 60, "jpg"), "AI厂商状态-2026-11-01-第60版.jpg");
  assert.equal(snapshotName("zh", "2026-11-01", 60, "pdf"), "AI厂商状态-2026-11-01-第60版.pdf");
  assert.equal(snapshotName("en", "2026-11-01", 1440, "jpg"), "ai-vendor-status-2026-11-01-edition-1440.jpg");
  assert.equal(snapshotName("en", "2026-11-01", 1, "pdf"), "ai-vendor-status-2026-11-01-edition-1.pdf");
});
