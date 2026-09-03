import { test } from "node:test";
import assert from "node:assert/strict";

// super_admin.js reads process.env.SUPER_ADMIN_IDS once at module load, so each
// case sets the env and imports a fresh module instance via a unique query string.

test("isSuperAdminId matches ids in SUPER_ADMIN_IDS and coerces to string", async () => {
  process.env.SUPER_ADMIN_IDS = " 111 , 222 ,333";
  const { isSuperAdminId, SUPER_ADMIN_IDS } = await import("./super_admin.js?c=set");
  assert.deepEqual(SUPER_ADMIN_IDS, ["111", "222", "333"]);
  assert.equal(isSuperAdminId("111"), true);
  assert.equal(isSuperAdminId(222), true);
  assert.equal(isSuperAdminId("333"), true);
  assert.equal(isSuperAdminId("444"), false);
});

test("isSuperAdminId is false for empty/nullish input", async () => {
  process.env.SUPER_ADMIN_IDS = "111";
  const { isSuperAdminId } = await import("./super_admin.js?c=nullish");
  assert.equal(isSuperAdminId(""), false);
  assert.equal(isSuperAdminId(null), false);
  assert.equal(isSuperAdminId(undefined), false);
});

test("isSuperAdminId is always false when SUPER_ADMIN_IDS is unset/empty", async () => {
  process.env.SUPER_ADMIN_IDS = "";
  const { isSuperAdminId } = await import("./super_admin.js?c=empty");
  assert.equal(isSuperAdminId("111"), false);
});
