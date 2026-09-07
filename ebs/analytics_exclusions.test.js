import { test } from "node:test";
import assert from "node:assert/strict";
import { ANALYTICS_EXCLUDED_CHANNEL_IDS } from "./analytics_exclusions.js";

test("ANALYTICS_EXCLUDED_CHANNEL_IDS contains our dev/test accounts as strings", () => {
  assert.deepEqual(ANALYTICS_EXCLUDED_CHANNEL_IDS, ["1198505560", "74034487"]);
  for (const id of ANALYTICS_EXCLUDED_CHANNEL_IDS) {
    assert.equal(typeof id, "string");
  }
});
