// A thin cache in front of an express-session Store's get() — specifically
// to collapse "thundering herd" bursts, where a single page load fires many
// concurrent requests (a dashboard page can easily fire a dozen API calls at
// once), each independently asking for the SAME session id within the same
// instant. Without this, every one of those is a separate DB round-trip
// competing for the same small connection pool; with it, only the first
// actually hits the database and the rest either piggyback on that in-flight
// read or reuse its just-cached result.
//
// TTL is deliberately short (a couple seconds) — long enough to flatten a
// burst of near-simultaneous requests from one page load, short enough that
// a session change (login, delegate switch, etc.) becomes visible again
// almost immediately. set()/destroy()/touch() all invalidate immediately so
// a write is never masked by a stale cached read.
export function wrapStoreWithReadCache(store, ttlMs = 2000) {
  const cache = new Map(); // sid -> { data, expiresAt } | { promise }

  const wrapped = Object.create(store);

  wrapped.get = function (sid, callback) {
    const cached = cache.get(sid);
    const now = Date.now();

    if (cached && cached.promise) {
      // A read for this sid is already in flight — piggyback on it instead
      // of starting a second concurrent DB query for the same row.
      cached.promise.then(
        (session) => callback(null, session),
        (err) => callback(err),
      );
      return;
    }

    if (cached && cached.expiresAt > now) {
      return callback(null, cached.data);
    }

    let resolveFn, rejectFn;
    const promise = new Promise((resolve, reject) => {
      resolveFn = resolve;
      rejectFn = reject;
    });
    cache.set(sid, { promise });

    store.get(sid, (err, session) => {
      if (err) {
        cache.delete(sid);
        rejectFn(err);
        callback(err);
        return;
      }
      cache.set(sid, { data: session, expiresAt: Date.now() + ttlMs });
      resolveFn(session);
      callback(null, session);
    });
  };

  wrapped.set = function (sid, session, callback) {
    cache.delete(sid);
    store.set(sid, session, callback);
  };

  wrapped.destroy = function (sid, callback) {
    cache.delete(sid);
    store.destroy(sid, callback);
  };

  wrapped.touch = function (sid, session, callback) {
    cache.delete(sid);
    if (typeof store.touch === "function") {
      store.touch(sid, session, callback);
    } else if (callback) {
      callback();
    }
  };

  return wrapped;
}
