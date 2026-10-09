import { test } from 'node:test';
import assert from 'node:assert/strict';

import { mountGoFundMeRoutes } from './routes_gofundme.js';

// Minimal express stand-in: captures handlers so they can be called directly.
function fakeApp() {
  const routes = {};
  return {
    routes,
    get: (path, fn) => { routes[`GET ${path}`] = fn; },
    post: (path, fn) => { routes[`POST ${path}`] = fn; },
  };
}

function fakeRes() {
  return {
    statusCode: 200,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
  };
}

function mount() {
  const app = fakeApp();
  const settingsWrites = [];
  mountGoFundMeRoutes(app, {
    getUserSettings: () => ({}),
    setUserSettings: (uid, patch) => settingsWrites.push({ uid, patch }),
    startGoFundMeForUser: () => {},
    // Mirrors resolveTimerUserIdFromRequest in server.js
    resolveTimerUserId: (req) => req.session?.managingAs || req.session?.twitchUser?.id,
  });
  return { app, settingsWrites };
}

const managingSession = { isAdmin: true, twitchUser: { id: 'admin-self' }, managingAs: 'managed-broadcaster' };

test('disconnect while managing another broadcaster clears THEIR settings, not the admin\'s', async () => {
  const { app, settingsWrites } = mount();
  const res = fakeRes();
  await app.routes['POST /api/gofundme/disconnect']({ session: managingSession, body: {} }, res);
  assert.equal(res.statusCode, 200);
  assert.deepEqual(settingsWrites.map((w) => w.uid), ['managed-broadcaster']);
});

test('connect while managing another broadcaster rejects bad links before any settings write', async () => {
  const { app, settingsWrites } = mount();
  const res = fakeRes();
  await app.routes['POST /api/gofundme/connect']({ session: managingSession, body: { url: 'not a link' } }, res);
  assert.equal(res.statusCode, 400);
  assert.equal(settingsWrites.length, 0);
});

test('status while managing another broadcaster reports on THEIR watcher', async () => {
  const app = fakeApp();
  const looked = [];
  mountGoFundMeRoutes(app, {
    getUserSettings: (uid) => { looked.push(uid); return { gfmSlug: 'x' }; },
    setUserSettings: () => {},
    startGoFundMeForUser: () => {},
    resolveTimerUserId: (req) => req.session?.managingAs || req.session?.twitchUser?.id,
  });
  const res = fakeRes();
  await app.routes['GET /api/gofundme/status']({ session: managingSession }, res);
  assert.deepEqual(looked, ['managed-broadcaster']);
});
