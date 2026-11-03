import assert from "node:assert/strict";
import { test } from "node:test";
import { withRetries } from "./retry.ts";

test("returns the first success after failures", async () => {
  let calls = 0;
  const value = await withRetries(
    "flaky",
    () => {
      calls++;
      if (calls < 3) throw new Error("timeout");
      return "ok";
    },
    [0, 0],
  );
  assert.equal(value, "ok");
  assert.equal(calls, 3);
});

test("gives up after the last wait with the last error", async () => {
  let calls = 0;
  await assert.rejects(
    withRetries(
      "down",
      () => {
        calls++;
        return Promise.reject(new Error(`attempt ${calls}`));
      },
      [0],
    ),
    /attempt 2/,
  );
  assert.equal(calls, 2);
});
