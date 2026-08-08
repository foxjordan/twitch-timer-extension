/**
 * Branded loading treatment shared across all three Twitch-facing views
 * (config, panel/mobile, component overlay). SplashScreen is the full-size
 * version (config, panel); CompactPulse is a smaller variant sized to sit
 * inside the overlay's existing frosted-glass card rather than provide its
 * own outer container.
 */
export function SplashScreen({ t, text }) {
  return (
    <div
      style={{
        maxWidth: 900,
        margin: "0 auto",
        minHeight: "60vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 16,
      }}
    >
      <style>{`
        @keyframes splashPulse {
          0%, 100% { transform: scaleY(0.4); }
          50% { transform: scaleY(1); }
        }
      `}</style>
      <div style={{ display: "flex", alignItems: "flex-end", gap: 5, height: 44 }}>
        {[16, 30, 44, 22, 34].map((h, i) => (
          <span
            key={i}
            style={{
              width: 6,
              height: h,
              borderRadius: 3,
              background: `linear-gradient(180deg, ${t.linkColor}, ${t.accent})`,
              animation: "splashPulse 1s ease-in-out infinite",
              animationDelay: `${i * 0.12}s`,
            }}
          />
        ))}
      </div>
      <div style={{ color: t.text, fontSize: 15, fontWeight: 600 }}>Livestreamer Hub</div>
      <div style={{ color: t.textMuted, fontSize: 13 }}>{text}</div>
    </div>
  );
}

export function CompactPulse({ text }) {
  return (
    <div
      style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 10,
      }}
    >
      <style>{`
        @keyframes compactPulse {
          0%, 100% { transform: scaleY(0.4); }
          50% { transform: scaleY(1); }
        }
      `}</style>
      <div style={{ display: "flex", alignItems: "flex-end", gap: 4, height: 22 }}>
        {[10, 22, 15].map((h, i) => (
          <span
            key={i}
            style={{
              width: 4,
              height: h,
              borderRadius: 2,
              background: "linear-gradient(180deg, #bf94ff, #9146ff)",
              animation: "compactPulse 1s ease-in-out infinite",
              animationDelay: `${i * 0.12}s`,
            }}
          />
        ))}
      </div>
      <div style={{ fontSize: 12, color: "rgba(239,239,241,0.6)" }}>{text}</div>
    </div>
  );
}
