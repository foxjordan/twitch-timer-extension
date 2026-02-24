import { useEffect, useRef, useState, useCallback } from "react";
import ReactDOM from "react-dom/client";
import { setupAnalytics, logEvent } from "./firebase.js";

const EBS_BASE = import.meta.env.VITE_EBS_BASE || "https://livestreamerhub.com";

const TIER_COSTS = {
  sound_10: "10",
  sound_25: "25",
  sound_50: "50",
  sound_75: "75",
  sound_100: "100",
  sound_150: "150",
  sound_200: "200",
  sound_250: "250",
  sound_300: "300",
  sound_500: "500",
  sound_1000: "1000",
};

function SpeakerIcon() {
  return (
    <svg
      width="28"
      height="28"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ opacity: 0.4 }}
    >
      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
      <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
      <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
    </svg>
  );
}

function useImageUrl(soundId, hasImage, auth) {
  const [url, setUrl] = useState(null);
  useEffect(() => {
    if (!hasImage || !auth) return;
    let revoked = false;
    let blobUrl;
    fetch(
      `${EBS_BASE}/api/sounds/image/${soundId}?channelId=${auth.channelId}`,
      { headers: { Authorization: `Bearer ${auth.token}` } }
    )
      .then((r) => (r.ok ? r.blob() : null))
      .then((blob) => {
        if (blob && !revoked) {
          blobUrl = URL.createObjectURL(blob);
          setUrl(blobUrl);
        }
      })
      .catch(() => {});
    return () => {
      revoked = true;
      if (blobUrl) URL.revokeObjectURL(blobUrl);
    };
  }, [soundId, hasImage, auth?.token, auth?.channelId]);
  return url;
}

function SoundCard({ sound, auth, disabled, onBuy, onPreview, isPreviewPlaying, getCost }) {
  const [hovered, setHovered] = useState(false);
  const imageUrl = useImageUrl(sound.id, sound.hasImage, auth);

  return (
    <div
      onClick={() => !disabled && onBuy(sound)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        padding: "6px 4px",
        borderRadius: 10,
        background: disabled
          ? "rgba(22,22,26,0.7)"
          : hovered
            ? "rgba(55,55,65,0.85)"
            : "rgba(42,42,50,0.8)",
        border: "1px solid rgba(48,48,56,0.6)",
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.5 : 1,
        transition: "background 0.15s, transform 0.1s",
        transform: hovered && !disabled ? "scale(1.04)" : "scale(1)",
        minWidth: 0,
        position: "relative",
      }}
    >
      {/* Image or default icon */}
      <div
        style={{
          width: 48,
          height: 48,
          borderRadius: 8,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "rgba(14,14,16,0.5)",
          overflow: "hidden",
          marginBottom: 4,
          position: "relative",
        }}
      >
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={sound.name}
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
          />
        ) : (
          <SpeakerIcon />
        )}
        {/* Preview overlay on hover */}
        {hovered && !disabled && (
          <div
            onClick={(e) => {
              e.stopPropagation();
              onPreview(e, sound);
            }}
            style={{
              position: "absolute",
              inset: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: "rgba(0,0,0,0.5)",
              borderRadius: 8,
              cursor: "pointer",
            }}
          >
            <span style={{ fontSize: 16, color: "#fff" }}>
              {isPreviewPlaying ? "\u25A0" : "\u25B6"}
            </span>
          </div>
        )}
      </div>
      {/* Name */}
      <div
        style={{
          fontSize: 11,
          fontWeight: 600,
          textAlign: "center",
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
          width: "100%",
          marginBottom: 2,
        }}
      >
        {sound.name}
      </div>
      {/* Bits cost */}
      <div
        style={{
          fontSize: 10,
          opacity: 0.7,
          display: "flex",
          alignItems: "center",
          gap: 2,
        }}
      >
        <span
          style={{
            width: 8,
            height: 8,
            borderRadius: "50%",
            background: "linear-gradient(135deg, #9146FF, #772CE8)",
            display: "inline-block",
          }}
        />
        {getCost(sound.tier)}
      </div>
    </div>
  );
}

function ComponentApp() {
  const authRef = useRef(null);
  const [auth, setAuth] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sounds, setSounds] = useState([]);
  const [soundsEnabled, setSoundsEnabled] = useState(false);
  const [bitsEnabled, setBitsEnabled] = useState(false);
  const [products, setProducts] = useState([]);
  const pendingSoundRef = useRef(null);
  const [cooldowns, setCooldowns] = useState({});
  const [lastPlayed, setLastPlayed] = useState(null);
  const [previewing, setPreviewing] = useState(null);
  const previewAudioRef = useRef(null);
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem("sa_collapsed") !== "false";
    } catch {
      return true;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem("sa_collapsed", String(collapsed));
    } catch {}
  }, [collapsed]);

  const fetchSounds = useCallback((token, channelId) => {
    fetch(`${EBS_BASE}/api/sounds/public?channelId=${channelId}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((data) => {
        setSounds(data.sounds || []);
        setSoundsEnabled(data.settings?.enabled ?? false);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    setupAnalytics();

    window.Twitch?.ext?.onAuthorized((authData) => {
      authRef.current = authData;
      setAuth(authData);
      logEvent("component_loaded", { channel_id: authData.channelId });

      if (window.Twitch?.ext?.features?.isBitsEnabled) {
        setBitsEnabled(true);
        window.Twitch.ext.bits
          .getProducts()
          .then((prods) => setProducts(prods))
          .catch(() => {});
      }

      window.Twitch?.ext?.features?.onChanged?.((changed) => {
        if (changed.includes("isBitsEnabled")) {
          setBitsEnabled(Boolean(window.Twitch?.ext?.features?.isBitsEnabled));
        }
      });

      fetchSounds(authData.token, authData.channelId);
    });

    window.Twitch?.ext?.bits?.onTransactionComplete?.((tx) => {
      const pending = pendingSoundRef.current;
      const currentAuth = authRef.current;
      if (pending && currentAuth) {
        fetch(`${EBS_BASE}/api/sounds/redeem`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${currentAuth.token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            receipt: tx.transactionReceipt,
            soundId: pending.id,
            channelId: currentAuth.channelId,
          }),
        })
          .then(() => {
            logEvent("sound_redeemed", { sound_name: pending.name, tier: pending.tier });
            setCooldowns((prev) => ({
              ...prev,
              [pending.id]: Date.now() + (pending.cooldownMs || 5000),
            }));
            setLastPlayed(pending.name);
            setTimeout(() => setLastPlayed(null), 3000);
          })
          .catch(() => {});
        pendingSoundRef.current = null;
      }
    });

    window.Twitch?.ext?.bits?.onTransactionCancelled?.(() => {
      pendingSoundRef.current = null;
    });

    window.Twitch?.ext?.listen?.("broadcast", (_t, _c, message) => {
      try {
        const data = JSON.parse(message);
        if (data.type === "sound_alert") {
          setLastPlayed(data.payload.soundName || "Sound");
          setTimeout(() => setLastPlayed(null), 3000);
        }
      } catch {}
    });
  }, [fetchSounds]);

  function handleSoundClick(sound) {
    if (!bitsEnabled) return;
    pendingSoundRef.current = sound;
    logEvent("sound_redeem_started", { sound_name: sound.name, tier: sound.tier });
    window.Twitch.ext.bits.useBits(sound.tier);
  }

  function handlePreview(e, sound) {
    e.stopPropagation();
    const currentAuth = authRef.current;
    if (!currentAuth) return;

    if (previewAudioRef.current) {
      previewAudioRef.current.pause();
      previewAudioRef.current = null;
      if (previewing === sound.id) {
        setPreviewing(null);
        return;
      }
    }

    setPreviewing(sound.id);
    logEvent("sound_preview", { sound_name: sound.name });
    fetch(
      `${EBS_BASE}/api/sounds/preview/${sound.id}?channelId=${currentAuth.channelId}`,
      { headers: { Authorization: `Bearer ${currentAuth.token}` } }
    )
      .then((r) => {
        if (!r.ok) throw new Error("fetch failed");
        return r.blob();
      })
      .then((blob) => {
        const url = URL.createObjectURL(blob);
        const audio = new Audio(url);
        audio.volume = 0.5;
        previewAudioRef.current = audio;
        audio.onended = () => {
          setPreviewing(null);
          previewAudioRef.current = null;
          URL.revokeObjectURL(url);
        };
        audio.play().catch(() => setPreviewing(null));
      })
      .catch(() => setPreviewing(null));
  }

  function getCost(tier) {
    const product = products.find((p) => p.sku === tier);
    if (product) return product.cost?.amount || TIER_COSTS[tier] || "?";
    return TIER_COSTS[tier] || "?";
  }

  // Collapsed pill button
  if (collapsed) {
    return (
      <div
        style={{
          position: "fixed",
          bottom: 12,
          right: 12,
        }}
      >
        <button
          onClick={() => setCollapsed(false)}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            padding: "8px 14px",
            borderRadius: 20,
            background: "rgba(14,14,16,0.85)",
            backdropFilter: "blur(8px)",
            border: "1px solid rgba(145,70,255,0.4)",
            color: "#efeff1",
            cursor: "pointer",
            fontSize: 13,
            fontWeight: 600,
            fontFamily: "inherit",
          }}
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
            <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
          </svg>
          Sounds
        </button>
      </div>
    );
  }

  // Loading state
  if (loading) {
    return (
      <div style={containerStyle}>
        <div style={headerStyle}>
          <span style={{ fontSize: 13, fontWeight: 600 }}>Sound Alerts</span>
          <button onClick={() => setCollapsed(true)} style={closeButtonStyle}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <path d="M18 6L6 18" /><path d="M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div style={{ padding: 12, textAlign: "center", fontSize: 12, opacity: 0.5 }}>
          Loading...
        </div>
      </div>
    );
  }

  // No sounds or disabled
  if (!soundsEnabled || sounds.length === 0) {
    return (
      <div style={containerStyle}>
        <div style={headerStyle}>
          <span style={{ fontSize: 13, fontWeight: 600 }}>Sound Alerts</span>
          <button onClick={() => setCollapsed(true)} style={closeButtonStyle}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <path d="M18 6L6 18" /><path d="M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div style={{ padding: 12, textAlign: "center", fontSize: 12, opacity: 0.5 }}>
          No sound alerts available
        </div>
      </div>
    );
  }

  return (
    <div style={containerStyle}>
      {/* Header */}
      <div style={headerStyle}>
        <span style={{ fontSize: 13, fontWeight: 600 }}>Sound Alerts</span>
        <button onClick={() => setCollapsed(true)} style={closeButtonStyle}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <path d="M18 6L6 18" /><path d="M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Now playing banner */}
      {lastPlayed && (
        <div
          style={{
            padding: "4px 10px",
            background: "#9146FF22",
            border: "1px solid #9146FF44",
            borderRadius: 6,
            fontSize: 11,
            textAlign: "center",
            margin: "0 10px 6px",
          }}
        >
          Now playing: {lastPlayed}
        </div>
      )}

      {!bitsEnabled && (
        <div style={{ fontSize: 11, opacity: 0.5, padding: "0 10px 6px", textAlign: "center" }}>
          Bits are not available on this channel.
        </div>
      )}

      {/* Card grid */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(72px, 1fr))",
          gap: 6,
          padding: "0 10px 10px",
        }}
      >
        {sounds.map((sound) => {
          const onCooldown =
            cooldowns[sound.id] && Date.now() < cooldowns[sound.id];
          const disabled = !bitsEnabled || onCooldown;
          return (
            <SoundCard
              key={sound.id}
              sound={sound}
              auth={auth}
              disabled={disabled}
              onBuy={handleSoundClick}
              onPreview={handlePreview}
              isPreviewPlaying={previewing === sound.id}
              getCost={getCost}
            />
          );
        })}
      </div>
    </div>
  );
}

const containerStyle = {
  position: "fixed",
  bottom: 12,
  right: 12,
  width: 280,
  maxHeight: "70vh",
  overflowY: "auto",
  borderRadius: 14,
  background: "rgba(14,14,16,0.85)",
  backdropFilter: "blur(12px)",
  border: "1px solid rgba(48,48,56,0.6)",
  boxShadow: "0 4px 24px rgba(0,0,0,0.4)",
};

const headerStyle = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  padding: "10px 12px 6px",
  position: "sticky",
  top: 0,
  background: "rgba(14,14,16,0.95)",
  borderRadius: "14px 14px 0 0",
  zIndex: 1,
};

const closeButtonStyle = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  width: 24,
  height: 24,
  borderRadius: 6,
  background: "transparent",
  border: "none",
  color: "#efeff1",
  cursor: "pointer",
  opacity: 0.6,
  padding: 0,
};

ReactDOM.createRoot(document.getElementById("root")).render(<ComponentApp />);
export default ComponentApp;
