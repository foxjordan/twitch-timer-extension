// Reporting model for the "Feature Usage" admin view. Pure — takes pre-aggregated
// rows from client_events and shapes the response. See
// docs/superpowers/specs/2026-09-02-dashboard-feature-usage-analytics-design.md
export const FEATURE_CATALOG = [
  { feature: 'timer', label: 'Timer / Countdown' },
  { feature: 'sounds', label: 'Sound Alerts' },
  { feature: 'tts', label: 'TTS' },
  { feature: 'goals', label: 'Goals' },
  { feature: 'extras', label: 'Extras' },
  { feature: 'wheel', label: 'Wheel' },
  { feature: 'prompts', label: 'Prompts' },
  { feature: 'plinko', label: 'Plinko' },
  { feature: 'delegates', label: 'Delegates' },
  { feature: 'streamelements', label: 'StreamElements' },
  { feature: 'youtube', label: 'YouTube' },
];

function index(rows) {
  // feature -> { reached, used, useEvents }
  const m = new Map();
  for (const r of rows || []) {
    if (!r || !r.feature) continue;
    const e = m.get(r.feature) || { reached: 0, used: 0, useEvents: 0 };
    const dc = Number(r.distinct_channels) || 0;
    const ec = Number(r.event_count) || 0;
    if (r.event_name === 'feature_view') e.reached = dc;
    else if (r.event_name === 'feature_use') { e.used = dc; e.useEvents = ec; }
    m.set(r.feature, e);
  }
  return m;
}

export function shapeFeatureUsage({ currentRows, prevRows, activeStreamers, registeredTotal }) {
  const cur = index(currentRows);
  const prev = index(prevRows);

  const features = FEATURE_CATALOG.map(({ feature, label }) => {
    const c = cur.get(feature) || { reached: 0, used: 0, useEvents: 0 };
    const p = prev.get(feature) || { reached: 0, used: 0, useEvents: 0 };
    const trend = c.used > p.used ? 'up' : c.used < p.used ? 'down' : 'flat';
    return {
      feature,
      label,
      reached: c.reached,
      used: c.used,
      useEvents: c.useEvents,
      reachedPrev: p.reached,
      usedPrev: p.used,
      trend,
      useRate: c.reached > 0 ? c.used / c.reached : 0,
    };
  });

  features.sort((a, b) => b.used - a.used || b.reached - a.reached || a.label.localeCompare(b.label));

  return {
    activeStreamers: Number(activeStreamers) || 0,
    registeredTotal: registeredTotal == null ? null : Number(registeredTotal) || 0,
    features,
  };
}
