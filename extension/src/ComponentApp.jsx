import { useEffect, useRef, useState, useCallback } from "react";
import ReactDOM from "react-dom/client";
import { setupAnalytics, logEvent } from "./firebase.js";

const EBS_BASE = import.meta.env.VITE_EBS_BASE || "https://livestreamerhub.com";

import { TIER_COSTS } from "./tiers.js";

function SpeakerIcon() {
  return (
    <svg
      width="100%"
      height="100%"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ opacity: 0.4, padding: "22%" }}
    >
      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
      <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
      <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
    </svg>
  );
}

function ClipIcon() {
  return (
    <svg
      width="100%"
      height="100%"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ opacity: 0.4, padding: "22%" }}
    >
      <rect x="2" y="2" width="20" height="20" rx="2.18" ry="2.18" />
      <line x1="7" y1="2" x2="7" y2="22" />
      <line x1="17" y1="2" x2="17" y2="22" />
      <line x1="2" y1="12" x2="22" y2="12" />
      <line x1="2" y1="7" x2="7" y2="7" />
      <line x1="2" y1="17" x2="7" y2="17" />
      <line x1="17" y1="7" x2="22" y2="7" />
      <line x1="17" y1="17" x2="22" y2="17" />
    </svg>
  );
}

function VideoIcon() {
  return (
    <svg
      width="100%"
      height="100%"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ opacity: 0.4, padding: "22%" }}
    >
      <polygon points="23 7 16 12 23 17 23 7" />
      <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
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
      { headers: { Authorization: `Bearer ${auth.token}` } },
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

function ChevronUp() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M18 15l-6-6-6 6" />
    </svg>
  );
}

function ChevronDown() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}

function SoundCard({
  sound,
  auth,
  disabled,
  onBuy,
  onPreview,
  isPreviewPlaying,
  getCost,
}) {
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
        padding: "5% 3%",
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
      {/* Image or default icon — square, responsive */}
      <div
        style={{
          width: "100%",
          paddingBottom: "100%",
          borderRadius: 8,
          position: "relative",
          background: "rgba(14,14,16,0.5)",
          overflow: "hidden",
          marginBottom: 4,
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {imageUrl ? (
            <img
              src={imageUrl}
              alt={sound.name}
              style={{ width: "100%", height: "100%", objectFit: "cover" }}
            />
          ) : (sound.type || "sound") === "clip" ? (
            <ClipIcon />
          ) : (sound.type || "sound") === "video" ? (
            <VideoIcon />
          ) : (
            <SpeakerIcon />
          )}
        </div>
        {/* Preview overlay on hover (sound/video types only) */}
        {hovered && !disabled && (sound.type || "sound") !== "clip" && (
          <div
            data-preview="true"
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
            <span style={{ fontSize: "clamp(14px, 4vw, 22px)", color: "#fff" }}>
              {isPreviewPlaying ? "\u25A0" : "\u25B6"}
            </span>
          </div>
        )}
      </div>
      {/* Name */}
      <div
        style={{
          fontSize: "clamp(10px, 2.8vw, 14px)",
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
          fontSize: "clamp(9px, 2.4vw, 13px)",
          opacity: 0.7,
          display: "flex",
          alignItems: "center",
          gap: 3,
        }}
      >
        <span
          style={{
            width: "clamp(6px, 2vw, 10px)",
            height: "clamp(6px, 2vw, 10px)",
            borderRadius: "50%",
            background: "linear-gradient(135deg, #9146FF, #772CE8)",
            display: "inline-block",
            flexShrink: 0,
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
  const gridRef = useRef(null);
  const [canScrollUp, setCanScrollUp] = useState(false);
  const [canScrollDown, setCanScrollDown] = useState(false);

  const checkScroll = useCallback(() => {
    const el = gridRef.current;
    if (!el) return;
    setCanScrollUp(el.scrollTop > 0);
    setCanScrollDown(el.scrollTop + el.clientHeight < el.scrollHeight - 1);
  }, []);

  function scrollBy(delta) {
    const el = gridRef.current;
    if (!el) return;
    el.scrollBy({ top: delta, behavior: "smooth" });
  }

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
            logEvent("sound_redeemed", {
              sound_name: pending.name,
              tier: pending.tier,
            });
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
    logEvent("sound_redeem_started", {
      sound_name: sound.name,
      tier: sound.tier,
    });
    window.Twitch.ext.bits.useBits(sound.tier);
  }

  function handlePreview(e, sound) {
    e.stopPropagation();
    const currentAuth = authRef.current;
    if (!currentAuth) return;

    // Skip preview for clip types
    if ((sound.type || "sound") === "clip") return;

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

    // Create Audio element synchronously in the user gesture handler
    // to preserve the gesture chain for Twitch iframe sandbox autoplay
    const audio = new Audio();
    audio.volume = 0.5;
    previewAudioRef.current = audio;

    fetch(
      `${EBS_BASE}/api/sounds/preview/${sound.id}?channelId=${currentAuth.channelId}`,
      { headers: { Authorization: `Bearer ${currentAuth.token}` } },
    )
      .then((r) => {
        if (!r.ok) throw new Error("fetch failed");
        return r.blob();
      })
      .then((blob) => {
        const url = URL.createObjectURL(blob);
        audio.src = url;
        audio.onended = () => {
          setPreviewing(null);
          previewAudioRef.current = null;
          URL.revokeObjectURL(url);
        };
        return audio.play();
      })
      .catch(() => {
        setPreviewing(null);
        previewAudioRef.current = null;
      });
  }

  function getCost(tier) {
    const product = products.find((p) => p.sku === tier);
    if (product) return product.cost?.amount || TIER_COSTS[tier] || "?";
    return TIER_COSTS[tier] || "?";
  }

  // Loading state
  if (loading) {
    return (
      <div style={containerStyle}>
        <div style={headerStyle}>
          <span>Sound Alerts</span>
        </div>
        <div style={{ padding: 12, textAlign: "center", opacity: 0.5 }}>
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
          <span>Sound Alerts</span>
        </div>
        <div style={{ padding: 12, textAlign: "center", opacity: 0.5 }}>
          No sound alerts available
        </div>
      </div>
    );
  }

  return (
    <div style={containerStyle}>
      {/* Header with scroll buttons */}
      <div style={headerStyle}>
        <span>Sound Alerts</span>
        <div style={{ display: "flex", gap: 2 }}>
          <button
            onClick={() => scrollBy(-150)}
            disabled={!canScrollUp}
            style={{
              ...scrollBtnStyle,
              opacity: canScrollUp ? 0.8 : 0.2,
              cursor: canScrollUp ? "pointer" : "default",
            }}
            aria-label="Scroll up"
          >
            <ChevronUp />
          </button>
          <button
            onClick={() => scrollBy(150)}
            disabled={!canScrollDown}
            style={{
              ...scrollBtnStyle,
              opacity: canScrollDown ? 0.8 : 0.2,
              cursor: canScrollDown ? "pointer" : "default",
            }}
            aria-label="Scroll down"
          >
            <ChevronDown />
          </button>
        </div>
      </div>

      {/* Now playing banner */}
      {lastPlayed && (
        <div
          style={{
            padding: "4px 10px",
            background: "#9146FF22",
            border: "1px solid #9146FF44",
            borderRadius: 6,
            textAlign: "center",
            margin: "0 10px 6px",
          }}
        >
          Now playing: {lastPlayed}
        </div>
      )}

      {!bitsEnabled && (
        <div
          style={{ opacity: 0.5, padding: "0 10px 6px", textAlign: "center" }}
        >
          Bits are not available on this channel.
        </div>
      )}

      {/* Scrollable card grid */}
      <div
        ref={gridRef}
        onScroll={checkScroll}
        onLoad={checkScroll}
        style={{
          flex: 1,
          overflowY: "auto",
          overflowX: "hidden",
          padding: "0 10px 10px",
          /* Hide scrollbar but keep functionality for touch/programmatic scroll */
          scrollbarWidth: "none",
          msOverflowStyle: "none",
        }}
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns:
              "repeat(auto-fill, minmax(min(80px, 30%), 1fr))",
            gap: "clamp(4px, 1.5vw, 8px)",
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
        {/* Sentinel to trigger initial scroll check */}
        <div
          ref={(el) => {
            if (el) setTimeout(checkScroll, 100);
          }}
        />
      </div>

      <style>{`::-webkit-scrollbar { display: none; }`}</style>
    </div>
  );
}

const containerStyle = {
  width: "100%",
  height: "100%",
  display: "flex",
  flexDirection: "column",
  overflow: "hidden",
  background: "rgba(14,14,16,0.85)",
  backdropFilter: "blur(12px)",
  fontSize: "clamp(11px, 2.8vw, 15px)",
};

const headerStyle = {
  padding: "10px 12px 6px",
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  fontWeight: 600,
  fontSize: "clamp(13px, 3.2vw, 17px)",
  flexShrink: 0,
};

const scrollBtnStyle = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  width: 28,
  height: 28,
  borderRadius: 6,
  background: "rgba(42,42,50,0.8)",
  border: "1px solid rgba(48,48,56,0.6)",
  color: "#efeff1",
  padding: 0,
  fontFamily: "inherit",
};

ReactDOM.createRoot(document.getElementById("root")).render(<ComponentApp />);
export default ComponentApp;
