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
        padding: "6px 4px",
        borderRadius: 10,
        background: disabled ? "#16161a" : hovered ? "#373741" : "#2a2a32",
        border: "1px solid #303038",
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.5 : 1,
        transition: "background 0.15s, transform 0.1s",
        transform: hovered && !disabled ? "scale(1.04)" : "scale(1)",
        minWidth: 0,
        position: "relative",
      }}
    >
      {/* Image or default icon — square */}
      <div
        style={{
          width: "100%",
          paddingBottom: "100%",
          borderRadius: 8,
          position: "relative",
          background: "#0e0e10",
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
            <span style={{ fontSize: 18, color: "#fff" }}>
              {isPreviewPlaying ? "\u25A0" : "\u25B6"}
            </span>
          </div>
        )}
      </div>
      {/* Name */}
      <div
        style={{
          fontSize: 12,
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
          fontSize: 11,
          opacity: 0.7,
          display: "flex",
          alignItems: "center",
          gap: 3,
        }}
      >
        <span
          style={{
            width: 8,
            height: 8,
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

function App() {
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
  const [ttsConfig, setTtsConfig] = useState(null); // public TTS config
  const [ttsVoice, setTtsVoice] = useState("");
  const [ttsMessage, setTtsMessage] = useState("");
  const [ttsValidating, setTtsValidating] = useState(false);
  const [ttsError, setTtsError] = useState(null);
  const [ttsCooldown, setTtsCooldown] = useState(false);
  const [previewingVoice, setPreviewingVoice] = useState(null);
  const [overlayConnected, setOverlayConnected] = useState(null); // null = unknown, true/false

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
      logEvent("panel_loaded", { channel_id: authData.channelId });

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
        // TTS redemption
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
            // Start cooldown
            setTtsCooldown(true);
            setTimeout(() => setTtsCooldown(false), pending.cooldownMs || 10000);
          })
          .catch((err) => setTtsError(err?.message || "TTS redemption failed"));
      } else {
        // Sound redemption (existing logic)
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

      // Store approval token and trigger Bits transaction
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

  if (loading) {
    return (
      <div style={{ padding: 12 }}>
        <div
          style={{
            padding: 14,
            borderRadius: 16,
            background: "#1f1f23",
            boxShadow: "0 0 0 1px #303038 inset",
          }}
        >
          <div
            style={{
              width: 100,
              height: 16,
              borderRadius: 6,
              background: "#2a2a32",
              marginBottom: 10,
              animation: "pulse 1.5s ease-in-out infinite",
            }}
          />
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(3, 1fr)",
              gap: 6,
            }}
          >
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div
                key={i}
                style={{
                  paddingBottom: "120%",
                  borderRadius: 8,
                  background: "#2a2a32",
                  animation: "pulse 1.5s ease-in-out infinite",
                  animationDelay: `${i * 0.1}s`,
                }}
              />
            ))}
          </div>
        </div>
        <style>{`@keyframes pulse { 0%,100% { opacity:.4 } 50% { opacity:.7 } }`}</style>
      </div>
    );
  }

  const hasSounds = soundsEnabled && sounds.length > 0;
  const hasTts = ttsConfig?.enabled;

  if (!hasSounds && !hasTts) {
    return (
      <div style={{ padding: 12 }}>
        <div
          style={{
            padding: 16,
            borderRadius: 16,
            background: "#1f1f23",
            boxShadow: "0 0 0 1px #303038 inset",
            textAlign: "center",
          }}
        >
          <div style={{ fontSize: 15, opacity: 0.5 }}>
            No alerts available
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: 12 }}>
      <div
        style={{
          padding: 14,
          borderRadius: 16,
          background: "#1f1f23",
          boxShadow: "0 0 0 1px #303038 inset",
        }}
      >
        {/* Tab bar (only show if both sounds and TTS are available) */}
        {hasSounds && hasTts && (
          <div style={{ display: "flex", gap: 4, marginBottom: 10 }}>
            <button
              onClick={() => setActiveTab("sounds")}
              style={{
                flex: 1,
                padding: "6px 0",
                borderRadius: 8,
                border: "none",
                fontSize: 13,
                fontWeight: 600,
                cursor: "pointer",
                background: activeTab === "sounds" ? "#9146FF" : "#303038",
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
                padding: "6px 0",
                borderRadius: 8,
                border: "none",
                fontSize: 13,
                fontWeight: 600,
                cursor: "pointer",
                background: activeTab === "tts" ? "#9146FF" : "#303038",
                color: "#fff",
                opacity: activeTab === "tts" ? 1 : 0.7,
              }}
            >
              TTS
            </button>
          </div>
        )}

        {/* Header */}
        <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 8 }}>
          <img src="./alert_wave.png" alt="" style={{ height: 36, width: 36, flexShrink: 0 }} />
          <div style={{ fontSize: 15, opacity: 0.85 }}>
            {(hasTts && (!hasSounds || activeTab === "tts")) ? "Text-to-Speech" : "Sound Alerts"}
          </div>
        </div>

        {overlayConnected === false && (
          <div
            style={{
              padding: "6px 10px",
              borderRadius: 8,
              background: "#ef444422",
              border: "1px solid #ef444444",
              fontSize: 11,
              marginBottom: 8,
              textAlign: "center",
              color: "#fca5a5",
            }}
          >
            The streamer's alert overlay is not currently active. Alerts may not play right now.
          </div>
        )}

        {lastPlayed && (
          <div
            style={{
              padding: "6px 10px",
              borderRadius: 8,
              background: "#9146FF22",
              border: "1px solid #9146FF44",
              fontSize: 12,
              marginBottom: 8,
              textAlign: "center",
            }}
          >
            Now playing: {lastPlayed}
          </div>
        )}

        {!bitsEnabled && (
          <div style={{ fontSize: 12, opacity: 0.5, marginBottom: 6 }}>
            Bits are not available on this channel.
          </div>
        )}

        {bitsEnabled && (
          <button
            onClick={() => window.Twitch?.ext?.bits?.showBitsBalance?.()}
            style={{
              background: "none",
              border: "none",
              color: "#bf94ff",
              fontSize: 12,
              cursor: "pointer",
              padding: 0,
              marginBottom: 8,
              textDecoration: "underline",
              opacity: 0.8,
            }}
          >
            Check your Bits balance
          </button>
        )}

        {/* Sounds tab */}
        {hasSounds && (!hasTts || activeTab === "sounds") && (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(80px, 1fr))",
              gap: 6,
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
        )}

        {/* TTS tab */}
        {hasTts && (!hasSounds || activeTab === "tts") && (
          <div>
            {ttsError && (
              <div
                style={{
                  padding: "6px 10px",
                  borderRadius: 8,
                  background: "#c0392b22",
                  border: "1px solid #c0392b44",
                  fontSize: 12,
                  marginBottom: 8,
                  color: "#e74c3c",
                }}
              >
                {ttsError}
              </div>
            )}

            {/* Voice selector */}
            <div style={{ marginBottom: 8 }}>
              <label style={{ fontSize: 12, opacity: 0.7, display: "block", marginBottom: 4 }}>
                Voice
              </label>
              <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                <select
                  value={ttsVoice}
                  onChange={(e) => setTtsVoice(e.target.value)}
                  style={{
                    flex: 1,
                    padding: "6px 10px",
                    borderRadius: 6,
                    border: "1px solid #303038",
                    background: "#0e0e10",
                    color: "#efeff1",
                    fontSize: 13,
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
                    border: "1px solid #303038",
                    borderRadius: 6,
                    padding: "5px 8px",
                    fontSize: 12,
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

            {/* Message input */}
            <div style={{ marginBottom: 8 }}>
              <label style={{ fontSize: 12, opacity: 0.7, display: "block", marginBottom: 4 }}>
                Message ({ttsMessage.length}/{ttsConfig.maxMessageLength || 300})
              </label>
              <textarea
                value={ttsMessage}
                onChange={(e) => setTtsMessage(e.target.value.slice(0, (ttsConfig.maxMessageLength || 300)))}
                maxLength={ttsConfig.maxMessageLength || 300}
                rows={3}
                placeholder="Type your message..."
                style={{
                  width: "100%",
                  boxSizing: "border-box",
                  padding: "6px 10px",
                  borderRadius: 6,
                  border: "1px solid #303038",
                  background: "#0e0e10",
                  color: "#efeff1",
                  fontSize: 13,
                  outline: "none",
                  resize: "vertical",
                  fontFamily: "inherit",
                }}
              />
            </div>

            {/* Submit button */}
            <button
              onClick={handleTtsSubmit}
              disabled={!bitsEnabled || ttsValidating || ttsCooldown || !ttsMessage.trim()}
              style={{
                width: "100%",
                padding: "8px 0",
                borderRadius: 8,
                border: "none",
                background: ttsValidating || ttsCooldown ? "#555" : "#9146FF",
                color: "#fff",
                fontSize: 14,
                fontWeight: 600,
                cursor: ttsValidating || ttsCooldown ? "not-allowed" : "pointer",
                opacity: !bitsEnabled || !ttsMessage.trim() ? 0.5 : 1,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 6,
              }}
            >
              <span
                style={{
                  width: 10,
                  height: 10,
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
      </div>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
export default App;
