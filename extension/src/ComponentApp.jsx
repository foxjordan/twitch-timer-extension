import { useEffect, useRef, useState, useCallback } from "react";
import ReactDOM from "react-dom/client";
import { setupAnalytics, logEvent } from "./firebase.js";

const EBS_BASE = import.meta.env.VITE_EBS_BASE || "https://livestreamerhub.com";

import { TIER_COSTS } from "./tiers.js";

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
  onRedeem,
  onPreview,
  isPreviewPlaying,
  getCost,
}) {
  const [hovered, setHovered] = useState(false);
  const imageUrl = useImageUrl(sound.id, sound.hasImage, auth);

  return (
    <div
      onClick={() => !disabled && onRedeem(sound)}
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
            <img
              src="./camera_icon.png"
              alt=""
              style={{ width: "60%", height: "60%", objectFit: "contain", opacity: 0.6 }}
            />
          ) : (
            <img
              src="./megaphone.png"
              alt=""
              style={{ width: "60%", height: "60%", objectFit: "contain", opacity: 0.6 }}
            />
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
  const pendingRef = useRef(null); // { type: "sound"|"tts", ...data }
  const [cooldowns, setCooldowns] = useState({});
  const [lastPlayed, setLastPlayed] = useState(null);
  const [previewing, setPreviewing] = useState(null);
  const previewAudioRef = useRef(null);

  // TTS state
  const [activeTab, setActiveTab] = useState("sounds");
  const [ttsConfig, setTtsConfig] = useState(null);
  const [ttsVoice, setTtsVoice] = useState("");
  const [ttsMessage, setTtsMessage] = useState("");
  const [ttsValidating, setTtsValidating] = useState(false);
  const [ttsError, setTtsError] = useState(null);
  const [ttsCooldown, setTtsCooldown] = useState(false);
  const [previewingVoice, setPreviewingVoice] = useState(null);
  const [overlayConnected, setOverlayConnected] = useState(null);
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

      // Fetch TTS public config
      fetch(`${EBS_BASE}/api/tts/public?channelId=${authData.channelId}`, {
        headers: { Authorization: `Bearer ${authData.token}` },
      })
        .then((r) => r.json())
        .then((data) => {
          if (data.enabled) {
            setTtsConfig(data);
            if (data.voices?.length > 0) setTtsVoice(data.voices[0].id);
          }
        })
        .catch(() => {});

      // Check overlay connection status
      fetch(`${EBS_BASE}/api/overlay/status?channelId=${authData.channelId}`)
        .then((r) => r.json())
        .then((data) => setOverlayConnected(data.connected))
        .catch(() => {});
    });

    window.Twitch?.ext?.bits?.onTransactionComplete?.((tx) => {
      const pending = pendingRef.current;
      const currentAuth = authRef.current;
      if (!pending || !currentAuth) return;
      pendingRef.current = null;

      if (pending.type === "tts") {
        fetch(`${EBS_BASE}/api/tts/redeem`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${currentAuth.token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            receipt: tx.transactionReceipt,
            approvalToken: pending.approvalToken,
            channelId: currentAuth.channelId,
          }),
        })
          .then(async (res) => {
            if (!res.ok) {
              const data = await res.json().catch(() => ({}));
              throw new Error(data.error || "TTS redemption failed");
            }
            logEvent("tts_redeemed", { voice: pending.voiceId });
            setTtsMessage("");
            setTtsError(null);
            setLastPlayed("TTS Message");
            setTimeout(() => setLastPlayed(null), 3000);
            setTtsCooldown(true);
            setTimeout(() => setTtsCooldown(false), pending.cooldownMs || 10000);
          })
          .catch((err) => setTtsError(err?.message || "TTS redemption failed"));
      } else {
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
      }
    });

    window.Twitch?.ext?.bits?.onTransactionCancelled?.(() => {
      pendingRef.current = null;
    });

    window.Twitch?.ext?.listen?.("broadcast", (_t, _c, message) => {
      try {
        const data = JSON.parse(message);
        if (data.type === "sound_alert") {
          setLastPlayed(data.payload.soundName || "Sound");
          setTimeout(() => setLastPlayed(null), 3000);
        }
        if (data.type === "tts_alert") {
          setLastPlayed("TTS: " + (data.payload.voiceName || "Message"));
          setTimeout(() => setLastPlayed(null), 3000);
        }
      } catch {}
    });
  }, [fetchSounds]);

  function handleSoundClick(sound) {
    if (!bitsEnabled) return;
    pendingRef.current = { type: "sound", ...sound };
    logEvent("sound_redeem_started", {
      sound_name: sound.name,
      tier: sound.tier,
    });
    window.Twitch.ext.bits.useBits(sound.tier);
  }

  async function handleTtsSubmit() {
    if (!bitsEnabled || !ttsConfig || ttsCooldown) return;
    const currentAuth = authRef.current;
    if (!currentAuth) return;

    const trimmed = ttsMessage.trim();
    if (!trimmed || !ttsVoice) return;

    setTtsValidating(true);
    setTtsError(null);

    try {
      const res = await fetch(`${EBS_BASE}/api/tts/validate`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${currentAuth.token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: trimmed,
          voiceId: ttsVoice,
          channelId: currentAuth.channelId,
        }),
      });
      const data = await res.json();

      if (!data.approved) {
        setTtsError(data.reason || "Message was not approved");
        setTtsValidating(false);
        return;
      }

      pendingRef.current = {
        type: "tts",
        approvalToken: data.approvalToken,
        voiceId: ttsVoice,
        cooldownMs: ttsConfig.cooldownMs || 10000,
      };
      logEvent("tts_redeem_started", { voice: ttsVoice });
      window.Twitch.ext.bits.useBits(ttsConfig.tier);
    } catch {
      setTtsError("Failed to validate message");
    } finally {
      setTtsValidating(false);
    }
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

  function playVoicePreview(voiceId) {
    const currentAuth = authRef.current;
    if (!currentAuth) return;
    if (previewAudioRef.current) {
      previewAudioRef.current.pause();
      previewAudioRef.current = null;
      setPreviewing(null);
    }
    if (previewingVoice === voiceId) {
      setPreviewingVoice(null);
      return;
    }
    setPreviewingVoice(voiceId);
    const audio = new Audio();
    audio.volume = 0.5;
    previewAudioRef.current = audio;
    fetch(`${EBS_BASE}/api/tts/preview/${encodeURIComponent(voiceId)}`, {
      headers: { Authorization: `Bearer ${currentAuth.token}` },
    })
      .then((r) => { if (!r.ok) throw new Error(); return r.blob(); })
      .then((blob) => {
        const url = URL.createObjectURL(blob);
        audio.src = url;
        audio.onended = () => { setPreviewingVoice(null); previewAudioRef.current = null; URL.revokeObjectURL(url); };
        return audio.play();
      })
      .catch(() => { setPreviewingVoice(null); previewAudioRef.current = null; });
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
          <span style={{ display: "flex", alignItems: "center", gap: 6 }}><img src="./alert_wave.png" alt="" style={{ height: 18, width: 18 }} />Sound Alerts</span>
        </div>
        <div style={{ padding: 12, textAlign: "center", opacity: 0.5 }}>
          Loading...
        </div>
      </div>
    );
  }

  const hasSounds = soundsEnabled && sounds.length > 0;
  const hasTts = ttsConfig?.enabled;

  // No sounds or TTS
  if (!hasSounds && !hasTts) {
    return (
      <div style={containerStyle}>
        <div style={headerStyle}>
          <span style={{ display: "flex", alignItems: "center", gap: 6 }}><img src="./alert_wave.png" alt="" style={{ height: 18, width: 18 }} />Sound Alerts</span>
        </div>
        <div style={{ padding: 12, textAlign: "center", opacity: 0.5 }}>
          No alerts available
        </div>
      </div>
    );
  }

  return (
    <div style={containerStyle}>
      {/* Header with scroll buttons */}
      <div style={headerStyle}>
        <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <img src="./alert_wave.png" alt="" style={{ height: 18, width: 18 }} />
          {(hasTts && (!hasSounds || activeTab === "tts")) ? "Text-to-Speech" : "Sound Alerts"}
        </span>
        {/* Only show scroll buttons on sounds tab */}
        {(!hasTts || activeTab === "sounds") && (
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
        )}
      </div>

      {/* Tab bar (only show if both sounds and TTS are available) */}
      {hasSounds && hasTts && (
        <div style={{ display: "flex", gap: 4, margin: "0 10px 6px" }}>
          <button
            onClick={() => setActiveTab("sounds")}
            style={{
              flex: 1,
              padding: "4px 0",
              borderRadius: 6,
              border: "none",
              fontSize: "clamp(10px, 2.6vw, 13px)",
              fontWeight: 600,
              cursor: "pointer",
              background: activeTab === "sounds" ? "#9146FF" : "rgba(48,48,56,0.8)",
              color: "#fff",
              opacity: activeTab === "sounds" ? 1 : 0.7,
            }}
          >
            Sounds
          </button>
          <button
            onClick={() => setActiveTab("tts")}
            style={{
              flex: 1,
              padding: "4px 0",
              borderRadius: 6,
              border: "none",
              fontSize: "clamp(10px, 2.6vw, 13px)",
              fontWeight: 600,
              cursor: "pointer",
              background: activeTab === "tts" ? "#9146FF" : "rgba(48,48,56,0.8)",
              color: "#fff",
              opacity: activeTab === "tts" ? 1 : 0.7,
            }}
          >
            TTS
          </button>
        </div>
      )}

      {/* Overlay disconnected warning */}
      {overlayConnected === false && (
        <div
          style={{
            padding: "4px 10px",
            background: "#ef444422",
            border: "1px solid #ef444444",
            borderRadius: 6,
            textAlign: "center",
            margin: "0 10px 6px",
            fontSize: 11,
            color: "#fca5a5",
          }}
        >
          The streamer's alert overlay is not currently active. Alerts may not play right now.
        </div>
      )}

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

      {/* Sounds tab — scrollable card grid */}
      {hasSounds && (!hasTts || activeTab === "sounds") && (
        <div
          ref={gridRef}
          onScroll={checkScroll}
          onLoad={checkScroll}
          style={{
            flex: 1,
            overflowY: "auto",
            overflowX: "hidden",
            padding: "0 10px 10px",
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
                  onRedeem={handleSoundClick}
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
      )}

      {/* TTS tab */}
      {hasTts && (!hasSounds || activeTab === "tts") && (
        <div style={{ flex: 1, display: "flex", flexDirection: "column", padding: "0 10px 10px", overflow: "hidden" }}>
          {ttsError && (
            <div
              style={{
                padding: "4px 8px",
                borderRadius: 6,
                background: "#c0392b22",
                border: "1px solid #c0392b44",
                fontSize: "clamp(9px, 2.4vw, 12px)",
                marginBottom: 6,
                color: "#e74c3c",
                flexShrink: 0,
              }}
            >
              {ttsError}
            </div>
          )}

          {/* Voice selector */}
          <div style={{ marginBottom: 6, flexShrink: 0 }}>
            <label style={{ fontSize: "clamp(9px, 2.4vw, 11px)", opacity: 0.7, display: "block", marginBottom: 2 }}>
              Voice
            </label>
            <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
              <select
                value={ttsVoice}
                onChange={(e) => setTtsVoice(e.target.value)}
                style={{
                  flex: 1,
                  padding: "4px 8px",
                  borderRadius: 6,
                  border: "1px solid rgba(48,48,56,0.6)",
                  background: "rgba(14,14,16,0.5)",
                  color: "#efeff1",
                  fontSize: "clamp(10px, 2.6vw, 13px)",
                  outline: "none",
                }}
              >
                {(ttsConfig.voices || []).map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.name}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => ttsVoice && playVoicePreview(ttsVoice)}
                style={{
                  background: "none",
                  border: "1px solid rgba(48,48,56,0.6)",
                  borderRadius: 6,
                  padding: "3px 6px",
                  fontSize: 11,
                  cursor: "pointer",
                  color: previewingVoice === ttsVoice ? "#9146ff" : "#aaa",
                  lineHeight: 1,
                }}
                title="Preview voice"
              >
                {previewingVoice === ttsVoice ? "\u23F9" : "\u25B6"}
              </button>
            </div>
          </div>

          {/* Message input — grows to fill available space */}
          <div style={{ marginBottom: 6, flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }}>
            <label style={{ fontSize: "clamp(9px, 2.4vw, 11px)", opacity: 0.7, display: "block", marginBottom: 2, flexShrink: 0 }}>
              Message ({ttsMessage.length}/{ttsConfig.maxMessageLength || 300})
            </label>
            <textarea
              value={ttsMessage}
              onChange={(e) => setTtsMessage(e.target.value.slice(0, (ttsConfig.maxMessageLength || 300)))}
              maxLength={ttsConfig.maxMessageLength || 300}
              placeholder="Type your message..."
              style={{
                width: "100%",
                flex: 1,
                minHeight: 40,
                padding: "4px 8px",
                borderRadius: 6,
                border: "1px solid rgba(48,48,56,0.6)",
                background: "rgba(14,14,16,0.5)",
                color: "#efeff1",
                fontSize: "clamp(10px, 2.6vw, 13px)",
                outline: "none",
                resize: "none",
                fontFamily: "inherit",
                boxSizing: "border-box",
              }}
            />
          </div>

          {/* Submit button */}
          <button
            onClick={handleTtsSubmit}
            disabled={!bitsEnabled || ttsValidating || ttsCooldown || !ttsMessage.trim()}
            style={{
              width: "100%",
              padding: "6px 0",
              borderRadius: 6,
              border: "none",
              background: ttsValidating || ttsCooldown ? "#555" : "#9146FF",
              color: "#fff",
              fontSize: "clamp(10px, 2.8vw, 14px)",
              fontWeight: 600,
              cursor: ttsValidating || ttsCooldown ? "not-allowed" : "pointer",
              opacity: !bitsEnabled || !ttsMessage.trim() ? 0.5 : 1,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 4,
              flexShrink: 0,
            }}
          >
            <span
              style={{
                width: "clamp(6px, 2vw, 10px)",
                height: "clamp(6px, 2vw, 10px)",
                borderRadius: "50%",
                background: "linear-gradient(135deg, #9146FF, #772CE8)",
                border: "1px solid rgba(255,255,255,0.3)",
                display: "inline-block",
                flexShrink: 0,
              }}
            />
            {ttsValidating
              ? "Checking..."
              : ttsCooldown
                ? "Cooldown..."
                : `Send TTS - ${getCost(ttsConfig.tier)} Bits`}
          </button>
        </div>
      )}

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
