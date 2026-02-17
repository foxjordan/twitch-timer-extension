import { useEffect, useRef, useState, useCallback } from "react";
import ReactDOM from "react-dom/client";

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

function App() {
  const authRef = useRef(null);
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
    // Twitch extension lifecycle
    window.Twitch?.ext?.onAuthorized((authData) => {
      authRef.current = authData;

      // Check Bits availability
      if (window.Twitch?.ext?.features?.isBitsEnabled) {
        setBitsEnabled(true);
        window.Twitch.ext.bits
          .getProducts()
          .then((prods) => setProducts(prods))
          .catch(() => {});
      }

      // Watch for feature flag changes
      window.Twitch?.ext?.features?.onChanged?.((changed) => {
        if (changed.includes("isBitsEnabled")) {
          setBitsEnabled(Boolean(window.Twitch?.ext?.features?.isBitsEnabled));
        }
      });

      // Fetch sounds for this channel
      fetchSounds(authData.token, authData.channelId);
    });

    // Transaction complete handler
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

    // PubSub listener for sound alerts
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
    window.Twitch.ext.bits.useBits(sound.tier);
  }

  function handlePreview(e, sound) {
    e.stopPropagation();
    const auth = authRef.current;
    if (!auth) return;

    // If already previewing this sound, stop it
    if (previewAudioRef.current) {
      previewAudioRef.current.pause();
      previewAudioRef.current = null;
      if (previewing === sound.id) {
        setPreviewing(null);
        return;
      }
    }

    setPreviewing(sound.id);
    fetch(
      `${EBS_BASE}/api/sounds/preview/${sound.id}?channelId=${auth.channelId}`,
      { headers: { Authorization: `Bearer ${auth.token}` } },
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
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              style={{
                height: 36,
                borderRadius: 8,
                background: "#2a2a32",
                marginBottom: 4,
                animation: "pulse 1.5s ease-in-out infinite",
                animationDelay: `${i * 0.15}s`,
              }}
            />
          ))}
        </div>
        <style>{`@keyframes pulse { 0%,100% { opacity:.4 } 50% { opacity:.7 } }`}</style>
      </div>
    );
  }

  // No sounds configured or alerts disabled
  if (!soundsEnabled || sounds.length === 0) {
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
            No sound alerts available
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
        <div style={{ fontSize: 15, opacity: 0.85, marginBottom: 8 }}>
          Sound Alerts
        </div>

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
              marginBottom: 6,
              textDecoration: "underline",
              opacity: 0.8,
            }}
          >
            Check your Bits balance
          </button>
        )}

        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          {sounds.map((sound) => {
            const onCooldown =
              cooldowns[sound.id] && Date.now() < cooldowns[sound.id];
            const disabled = !bitsEnabled || onCooldown;
            const isPreviewPlaying = previewing === sound.id;
            return (
              <div
                key={sound.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 4,
                }}
              >
                <button
                  onClick={(e) => handlePreview(e, sound)}
                  title={isPreviewPlaying ? "Stop preview" : "Preview sound"}
                  style={{
                    flexShrink: 0,
                    width: 32,
                    height: 36,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    background: isPreviewPlaying ? "#9146FF33" : "#2a2a32",
                    border: "1px solid #303038",
                    borderRadius: 8,
                    color: isPreviewPlaying ? "#bf94ff" : "#efeff1",
                    cursor: "pointer",
                    fontSize: 14,
                    padding: 0,
                    transition: "background 0.15s",
                  }}
                >
                  {isPreviewPlaying ? "\u25A0" : "\u25B6"}
                </button>
                <button
                  disabled={disabled}
                  onClick={() => handleSoundClick(sound)}
                  style={{
                    flex: 1,
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: "8px 12px",
                    background: disabled ? "#16161a" : "#2a2a32",
                    border: "1px solid #303038",
                    borderRadius: 8,
                    color: "#efeff1",
                    cursor: disabled ? "not-allowed" : "pointer",
                    opacity: disabled ? 0.5 : 1,
                    fontSize: 13,
                    transition: "background 0.15s",
                  }}
                >
                  <span style={{ fontWeight: 600 }}>{sound.name}</span>
                  <span
                    style={{
                      fontSize: 12,
                      opacity: 0.7,
                      display: "flex",
                      alignItems: "center",
                      gap: 4,
                    }}
                  >
                    <span
                      style={{
                        display: "inline-block",
                        width: 12,
                        height: 12,
                        borderRadius: "50%",
                        background: "linear-gradient(135deg, #9146FF, #772CE8)",
                      }}
                    />
                    {getCost(sound.tier)}
                  </span>
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
export default App;
