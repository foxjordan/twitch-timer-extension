import * as Sentry from '@sentry/node';

// Loaded via `node --import ./instrument.js` before any other module.
// Must stay side-effect-only — no imports from the rest of the app.
Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV || 'production',
  // Derive a release tag from the Fly image ref (changes on every deploy).
  // Format: "deployment-XXXXX" extracted from registry.fly.io/app:deployment-XXXXX
  release: process.env.FLY_IMAGE_REF?.split(':').pop(),
  // Capture unhandled promise rejections and uncaught exceptions automatically.
  // Disable if SENTRY_DSN is not set (Sentry silently no-ops anyway, but be explicit).
  enabled: Boolean(process.env.SENTRY_DSN),
});

// TODO: remove after confirming Sentry pipeline works end-to-end
if (process.env.SENTRY_DSN) {
  Sentry.captureMessage('ebs_startup_test', 'info');
}
