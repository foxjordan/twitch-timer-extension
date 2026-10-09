import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  parseFundraiserSlug,
  normalizeDonation,
  createGoFundMeWatcher,
  normalizeCursor,
} from './gofundme.js';

// ---- parseFundraiserSlug ----

test('parseFundraiserSlug accepts full URLs, bare hosts, and bare slugs', () => {
  assert.equal(parseFundraiserSlug('https://www.gofundme.com/f/help-jane-recover'), 'help-jane-recover');
  assert.equal(parseFundraiserSlug('https://www.gofundme.com/f/help-jane-recover?qid=abc#top'), 'help-jane-recover');
  assert.equal(parseFundraiserSlug('gofundme.com/f/help-jane-recover/'), 'help-jane-recover');
  assert.equal(parseFundraiserSlug('https://gofundme.com/en-gb/f/help-jane-recover'), 'help-jane-recover');
  assert.equal(parseFundraiserSlug('  help-jane-recover  '), 'help-jane-recover');
  assert.equal(parseFundraiserSlug('Help-Jane-Recover'), 'help-jane-recover');
});

test('parseFundraiserSlug rejects junk and non-fundraiser URLs', () => {
  assert.equal(parseFundraiserSlug(''), null);
  assert.equal(parseFundraiserSlug(null), null);
  assert.equal(parseFundraiserSlug('https://www.gofundme.com/discover'), null);
  assert.equal(parseFundraiserSlug('https://evil.com/f/help-jane'), null);
  assert.equal(parseFundraiserSlug('../../etc/passwd'), null);
  assert.equal(parseFundraiserSlug('has spaces in it'), null);
});

// ---- normalizeDonation ----

test('normalizeDonation maps the feed shape and hides anonymous names', () => {
  assert.deepEqual(
    normalizeDonation({ donation_id: 15, amount: 25.0, currencycode: 'USD', name: 'Jane D', is_anonymous: false, is_offline: false, created_at: 't' }),
    { id: 15, amount: 25, currency: 'USD', username: 'Jane D', isOffline: false, createdAt: 't' },
  );
  assert.equal(normalizeDonation({ donation_id: 16, amount: 5, name: 'Real Name', is_anonymous: true }).username, 'Anonymous');
  assert.equal(normalizeDonation({ donation_id: 17, amount: 5 }).currency, 'USD');
});

test('normalizeDonation drops entries without a usable id or amount', () => {
  assert.equal(normalizeDonation({ amount: 5 }), null);
  assert.equal(normalizeDonation({ donation_id: 1, amount: 0 }), null);
  assert.equal(normalizeDonation({ donation_id: 1, amount: 'abc' }), null);
  assert.equal(normalizeDonation(null), null);
});

// ---- createGoFundMeWatcher ----

// Fake feed: `donations` is the full list newest-first; pages are served by offset.
function fakeFeed(donations, { pageSize = 20 } = {}) {
  const calls = [];
  const fetchPage = async (slug, offset) => {
    calls.push(offset);
    const page = donations.slice(offset, offset + pageSize);
    return { donations: page, hasNext: offset + pageSize < donations.length };
  };
  return { fetchPage, calls };
}

const d = (id, extra = {}) => ({ donation_id: id, amount: 10, currencycode: 'USD', name: 'D' + id, ...extra });

function makeWatcher({ feed, lastDonationId = null, gate = () => ({ ok: true }), pageSize = 20 }) {
  const credited = [];
  const cursors = [];
  const w = createGoFundMeWatcher({
    slug: 'test-slug',
    lastDonationId,
    fetchPage: feed.fetchPage,
    pageSize,
    shouldPoll: () => gate(),
    onDonation: (don) => credited.push(don.id),
    onCursor: (id) => cursors.push(id),
  });
  return { w, credited, cursors };
}

test('first poll with no saved cursor baselines and credits nothing', async () => {
  const feed = fakeFeed([d(30), d(20), d(10)]);
  const { w, credited, cursors } = makeWatcher({ feed });
  await w.tick();
  assert.deepEqual(credited, []);
  assert.deepEqual(cursors, [30]);
});

test('baselining an empty fundraiser still credits its first donation later', async () => {
  const list = [];
  const feed = fakeFeed(list);
  const { w, credited } = makeWatcher({ feed });
  await w.tick();
  list.unshift(d(5));
  await w.tick();
  assert.deepEqual(credited, [5]);
});

test('new donations are credited oldest-first and advance the cursor', async () => {
  const list = [d(30), d(20)];
  const feed = fakeFeed(list);
  const { w, credited, cursors } = makeWatcher({ feed });
  await w.tick();
  list.unshift(d(40), d(35));
  await w.tick();
  assert.deepEqual(credited, [35, 40]);
  assert.deepEqual(cursors, [30, 40]);
  await w.tick();
  assert.deepEqual(credited, [35, 40], 'no double credit on an unchanged feed');
});

test('offline donations are skipped but still advance the cursor', async () => {
  const list = [d(10)];
  const feed = fakeFeed(list);
  const { w, credited, cursors } = makeWatcher({ feed });
  await w.tick();
  list.unshift(d(12), d(11, { is_offline: true }));
  await w.tick();
  assert.deepEqual(credited, [12]);
  assert.equal(cursors.at(-1), 12);
});

test('a saved cursor (server restart while live) resumes without re-baselining', async () => {
  const feed = fakeFeed([d(50), d(40), d(30)]);
  const { w, credited } = makeWatcher({ feed, lastDonationId: 40 });
  await w.tick();
  assert.deepEqual(credited, [50]);
});

test('closed gate makes no request; reopening re-baselines and skips missed donations', async () => {
  const list = [d(10)];
  const feed = fakeFeed(list);
  let open = true;
  const { w, credited } = makeWatcher({ feed, gate: () => (open ? { ok: true } : { ok: false, reason: 'paused' }) });
  await w.tick();
  const callsBefore = feed.calls.length;

  open = false;
  list.unshift(d(11), d(12));
  await w.tick();
  assert.equal(feed.calls.length, callsBefore, 'no fetch while gated');
  assert.equal(w.status().status, 'idle');
  assert.equal(w.status().idleReason, 'paused');

  open = true;
  await w.tick();
  assert.deepEqual(credited, [], 'donations made while paused are not credited');
  list.unshift(d(13));
  await w.tick();
  assert.deepEqual(credited, [13]);
});

test('a saved cursor is discarded if the first tick finds the gate closed', async () => {
  const feed = fakeFeed([d(50), d(40)]);
  let open = false;
  const { w, credited } = makeWatcher({ feed, lastDonationId: 40, gate: () => (open ? { ok: true } : { ok: false, reason: 'offline' }) });
  await w.tick();
  open = true;
  await w.tick();
  assert.deepEqual(credited, [], 'donation 50 arrived while offline, so it is skipped');
});

test('pages through a burst of new donations, capped at maxPages', async () => {
  const list = [d(1)];
  const feed = fakeFeed(list, { pageSize: 2 });
  const { w, credited } = makeWatcher({ feed, pageSize: 2 });
  await w.tick();
  list.unshift(d(6), d(5), d(4), d(3), d(2));
  await w.tick();
  assert.deepEqual(credited, [2, 3, 4, 5, 6]);
});

test('fetch errors back off and surface in status without advancing the cursor', async () => {
  let fail = false;
  const list = [d(10)];
  const base = fakeFeed(list);
  const feed = { fetchPage: async (...a) => { if (fail) throw new Error('HTTP 503'); return base.fetchPage(...a); }, calls: base.calls };
  let now = 0;
  const credited = [];
  const w = createGoFundMeWatcher({
    slug: 's', lastDonationId: null, fetchPage: feed.fetchPage,
    shouldPoll: () => ({ ok: true }), onDonation: (x) => credited.push(x.id), onCursor: () => {},
    now: () => now,
  });
  await w.tick();
  fail = true;
  list.unshift(d(11));
  await w.tick();
  assert.equal(w.status().status, 'error');
  assert.match(w.status().error, /503/);

  fail = false;
  now += 1000; // still inside the backoff window
  await w.tick();
  assert.deepEqual(credited, []);

  now += 10 * 60 * 1000;
  await w.tick();
  assert.deepEqual(credited, [11]);
  assert.equal(w.status().status, 'watching');
});

// ---- normalizeCursor (settings boundary) ----

test('normalizeCursor keeps "no cursor" as null — Number(null) would be 0 and credit every past donation', () => {
  assert.equal(normalizeCursor(null), null);
  assert.equal(normalizeCursor(undefined), null);
  assert.equal(normalizeCursor(''), null);
  assert.equal(normalizeCursor('abc'), null);
  assert.equal(normalizeCursor(-5), null);
});

test('normalizeCursor keeps real cursors, including 0 from baselining an empty fundraiser', () => {
  assert.equal(normalizeCursor(0), 0);
  assert.equal(normalizeCursor(1578982025), 1578982025);
  assert.equal(normalizeCursor('1578982025'), 1578982025);
});

test('a reset cursor round-tripped through settings still baselines instead of crediting history', async () => {
  const feed = fakeFeed([d(30), d(20), d(10)]);
  const { w, credited } = makeWatcher({ feed, lastDonationId: normalizeCursor(null) });
  await w.tick();
  assert.deepEqual(credited, []);
});

// ---- stop() (poller replaced by a login / reconnect mid-request) ----

test('a watcher stopped while its request is in flight credits nothing and saves no cursor', async () => {
  const list = [d(10)];
  let release;
  let hold = false;
  const base = fakeFeed(list);
  const fetchPage = async (...a) => {
    if (hold) await new Promise((r) => { release = r; });
    return base.fetchPage(...a);
  };
  const credited = [];
  const cursors = [];
  const w = createGoFundMeWatcher({
    slug: 's', lastDonationId: 10, fetchPage,
    shouldPoll: () => ({ ok: true }), onDonation: (x) => credited.push(x.id), onCursor: (id) => cursors.push(id),
  });

  list.unshift(d(11));
  hold = true;
  const inFlight = w.tick();
  await new Promise((r) => setImmediate(r));
  w.stop(); // replaced by a new watcher, which will credit #11 itself
  release();
  await inFlight;

  assert.deepEqual(credited, [], 'old watcher must not credit after being replaced');
  assert.deepEqual(cursors, []);
});

test('a stopped watcher ignores further ticks', async () => {
  const feed = fakeFeed([d(10)]);
  const { w } = makeWatcher({ feed, lastDonationId: 5 });
  w.stop();
  await w.tick();
  assert.equal(feed.calls.length, 0);
});
