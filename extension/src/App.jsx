import { useEffect, useRef, useState, useCallback } from 'react';
import ReactDOM from 'react-dom/client';
import { initializeAnalytics } from './firebase';

const EBS_BASE =
  import.meta.env.VITE_EBS_BASE || 'https://twitch-timer-extension.fly.dev';

const TIER_COSTS = {
  sound_10: '10',
  sound_25: '25',
  sound_50: '50',
  sound_75: '75',
  sound_100: '100',
  sound_150: '150',
  sound_200: '200',
  sound_300: '300',
  sound_500: '500',
  sound_1000: '1000',
};

function App() {
  const [remaining, setRemaining] = useState(0);
  const [hype, setHype] = useState(false);
  const tickRef = useRef();

  // Sound alert state
  const authRef = useRef(null);
  const [sounds, setSounds] = useState([]);
  const [soundsEnabled, setSoundsEnabled] = useState(false);
  const [bitsEnabled, setBitsEnabled] = useState(false);
  const [products, setProducts] = useState([]);
  const pendingSoundRef = useRef(null);
  const [cooldowns, setCooldowns] = useState({});
  const [lastPlayed, setLastPlayed] = useState(null);

  const fetchSounds = useCallback((token, channelId) => {
    fetch(`${EBS_BASE}/api/sounds/public?channelId=${channelId}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((data) => {
        setSounds(data.sounds || []);
        setSoundsEnabled(data.settings?.enabled ?? false);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    initializeAnalytics();

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
        if (changed.includes('isBitsEnabled')) {
          setBitsEnabled(
            Boolean(window.Twitch?.ext?.features?.isBitsEnabled)
          );
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
          method: 'POST',
          headers: {
            Authorization: `Bearer ${currentAuth.token}`,
            'Content-Type': 'application/json',
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

    // PubSub listener for timer + sound alerts
    window.Twitch?.ext?.listen?.('broadcast', (_t, _c, message) => {
      try {
        const data = JSON.parse(message);
        if (data.type === 'timer_reset' || data.type === 'timer_tick') {
          setRemaining(data.payload.remaining ?? 0);
          if (typeof data.payload.hype !== 'undefined') {
            setHype(Boolean(data.payload.hype));
          }
        } else if (data.type === 'timer_add') {
          setRemaining(data.payload.newRemaining ?? 0);
          setHype(Boolean(data.payload.hype));
        } else if (data.type === 'sound_alert') {
          setLastPlayed(data.payload.soundName || 'Sound');
          setTimeout(() => setLastPlayed(null), 3000);
        }
      } catch {}
    });

    // Local decrement for smoothness between server ticks
    const loop = () => {
      setRemaining((r) => (r > 0 ? r - 1 : 0));
      tickRef.current = setTimeout(loop, 1000);
    };
    loop();
    return () => clearTimeout(tickRef.current);
  }, [fetchSounds]);

  function handleSoundClick(sound) {
    if (!bitsEnabled) return;
    pendingSoundRef.current = sound;
    window.Twitch.ext.bits.useBits(sound.tier);
  }

  function getCost(tier) {
    const product = products.find((p) => p.sku === tier);
    if (product) return product.cost?.amount || TIER_COSTS[tier] || '?';
    return TIER_COSTS[tier] || '?';
  }

  const mm = String(Math.floor(remaining / 60)).padStart(2, '0');
  const ss = String(remaining % 60).padStart(2, '0');

  return (
    <div style={{ padding: 12 }}>
      {/* Timer Section */}
      <div
        style={{
          padding: 16,
          borderRadius: 16,
          background: '#1f1f23',
          boxShadow: '0 0 0 1px #303038 inset',
        }}
      >
        <div style={{ fontSize: 18, opacity: 0.85 }}>Stream Countdown</div>
        <div
          style={{
            fontFamily: 'monospace',
            fontSize: 64,
            lineHeight: 1,
            marginTop: 8,
          }}
        >
          {mm}:{ss}
        </div>
        {hype && (
          <div
            style={{
              marginTop: 8,
              padding: '6px 10px',
              borderRadius: 999,
              display: 'inline-block',
              background: '#9146FF22',
              boxShadow: '0 0 0 1px #9146FF inset',
              fontSize: 12,
            }}
          >
            🔥 Hype Train active — time gains doubled!
          </div>
        )}
      </div>

      {/* Sound Alerts Section */}
      {soundsEnabled && sounds.length > 0 && (
        <div style={{ marginTop: 12 }}>
          <div
            style={{
              padding: 14,
              borderRadius: 16,
              background: '#1f1f23',
              boxShadow: '0 0 0 1px #303038 inset',
            }}
          >
            <div style={{ fontSize: 15, opacity: 0.85, marginBottom: 8 }}>
              Sound Alerts
            </div>

            {lastPlayed && (
              <div
                style={{
                  padding: '6px 10px',
                  borderRadius: 8,
                  background: '#9146FF22',
                  border: '1px solid #9146FF44',
                  fontSize: 12,
                  marginBottom: 8,
                  textAlign: 'center',
                }}
              >
                🔊 {lastPlayed}
              </div>
            )}

            {!bitsEnabled && (
              <div style={{ fontSize: 12, opacity: 0.5, marginBottom: 6 }}>
                Bits are not available on this channel.
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {sounds.map((sound) => {
                const onCooldown =
                  cooldowns[sound.id] && Date.now() < cooldowns[sound.id];
                const disabled = !bitsEnabled || onCooldown;
                return (
                  <button
                    key={sound.id}
                    disabled={disabled}
                    onClick={() => handleSoundClick(sound)}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      width: '100%',
                      padding: '8px 12px',
                      background: disabled ? '#16161a' : '#2a2a32',
                      border: '1px solid #303038',
                      borderRadius: 8,
                      color: '#efeff1',
                      cursor: disabled ? 'not-allowed' : 'pointer',
                      opacity: disabled ? 0.5 : 1,
                      fontSize: 13,
                      transition: 'background 0.15s',
                    }}
                  >
                    <span style={{ fontWeight: 600 }}>{sound.name}</span>
                    <span
                      style={{
                        fontSize: 12,
                        opacity: 0.7,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 4,
                      }}
                    >
                      <span
                        style={{
                          display: 'inline-block',
                          width: 12,
                          height: 12,
                          borderRadius: '50%',
                          background:
                            'linear-gradient(135deg, #9146FF, #772CE8)',
                        }}
                      />
                      {getCost(sound.tier)}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
export default App;