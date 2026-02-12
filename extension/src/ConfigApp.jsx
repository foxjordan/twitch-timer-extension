import { useEffect, useState, useRef, useCallback } from "react";
import ReactDOM from "react-dom/client";

const EBS_BASE =
  import.meta.env.VITE_EBS_BASE || "https://twitch-timer-extension.fly.dev";

const TIER_LABELS = {
  sound_10: "10 Bits",
  sound_25: "25 Bits",
  sound_50: "50 Bits",
  sound_75: "75 Bits",
  sound_100: "100 Bits",
  sound_150: "150 Bits",
  sound_200: "200 Bits",
  sound_300: "300 Bits",
  sound_500: "500 Bits",
  sound_1000: "1000 Bits",
};

function ConfigApp() {
  const [auth, setAuth] = useState(null);
  const [sounds, setSounds] = useState([]);
  const [settings, setSettings] = useState({
    enabled: true,
    globalVolume: 100,
    globalCooldownMs: 3000,
    maxQueueSize: 5,
    overlayDurationMs: 5000,
  });
  const [tiers, setTiers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const fileRef = useRef(null);
  const [newName, setNewName] = useState("");
  const [newTier, setNewTier] = useState("sound_100");
  const [newVolume, setNewVolume] = useState(80);

  const headers = useCallback(
    () => ({
      Authorization: `Bearer ${auth?.token}`,
    }),
    [auth],
  );

  const fetchSounds = useCallback(
    async (token) => {
      try {
        const res = await fetch(`${EBS_BASE}/api/sounds`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) throw new Error("Failed to fetch sounds");
        const data = await res.json();
        setSounds(data.sounds || []);
        setSettings(data.settings || settings);
        setTiers(data.tiers || []);
      } catch (e) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    },
    [settings],
  );

  useEffect(() => {
    window.Twitch?.ext?.onAuthorized((authData) => {
      setAuth(authData);
      fetchSounds(authData.token);
    });
  }, [fetchSounds]);

  function flash(msg) {
    setSuccess(msg);
    setTimeout(() => setSuccess(null), 3000);
  }

  async function handleUpload(e) {
    e.preventDefault();
    setError(null);
    const file = fileRef.current?.files?.[0];
    if (!file) return setError("Select an audio file");
    if (file.size > 1024 * 1024) return setError("File must be under 1 MB");

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("name", newName || file.name.replace(/\.[^.]+$/, ""));
      formData.append("tier", newTier);
      formData.append("volume", String(newVolume));

      const res = await fetch(`${EBS_BASE}/api/sounds`, {
        method: "POST",
        headers: headers(),
        body: formData,
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Upload failed");
      }
      await fetchSounds(auth.token);
      setNewName("");
      setNewTier("sound_tier_1");
      setNewVolume(80);
      if (fileRef.current) fileRef.current.value = "";
      flash("Sound uploaded");
    } catch (e) {
      setError(e.message);
    } finally {
      setUploading(false);
    }
  }

  async function handleDelete(soundId) {
    setError(null);
    try {
      const res = await fetch(`${EBS_BASE}/api/sounds/${soundId}`, {
        method: "DELETE",
        headers: headers(),
      });
      if (!res.ok) throw new Error("Delete failed");
      await fetchSounds(auth.token);
      flash("Sound deleted");
    } catch (e) {
      setError(e.message);
    }
  }

  async function handleToggle(soundId, enabled) {
    setError(null);
    try {
      const res = await fetch(`${EBS_BASE}/api/sounds/${soundId}`, {
        method: "PUT",
        headers: { ...headers(), "Content-Type": "application/json" },
        body: JSON.stringify({ enabled }),
      });
      if (!res.ok) throw new Error("Update failed");
      await fetchSounds(auth.token);
    } catch (e) {
      setError(e.message);
    }
  }

  async function handleSoundUpdate(soundId, patch) {
    setError(null);
    try {
      const res = await fetch(`${EBS_BASE}/api/sounds/${soundId}`, {
        method: "PUT",
        headers: { ...headers(), "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      if (!res.ok) throw new Error("Update failed");
      await fetchSounds(auth.token);
    } catch (e) {
      setError(e.message);
    }
  }

  async function handleSettingsUpdate(patch) {
    setError(null);
    try {
      const res = await fetch(`${EBS_BASE}/api/sounds/settings`, {
        method: "POST",
        headers: { ...headers(), "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      if (!res.ok) throw new Error("Settings update failed");
      const data = await res.json();
      setSettings(data.settings);
      flash("Settings saved");
    } catch (e) {
      setError(e.message);
    }
  }

  if (!auth) {
    return (
      <div style={styles.container}>
        <p style={styles.muted}>Connecting...</p>
      </div>
    );
  }
  if (loading) {
    return (
      <div style={styles.container}>
        <p style={styles.muted}>Loading sounds...</p>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <h2 style={styles.heading}>Sound Alerts</h2>

      {error && <div style={styles.error}>{error}</div>}
      {success && <div style={styles.success}>{success}</div>}

      {/* Global Settings */}
      <div style={styles.card}>
        <h3 style={styles.subHeading}>Settings</h3>
        <label style={styles.row}>
          <span>Enabled</span>
          <input
            type="checkbox"
            checked={settings.enabled}
            onChange={(e) =>
              handleSettingsUpdate({ enabled: e.target.checked })
            }
          />
        </label>
        <label style={styles.row}>
          <span>Global Volume</span>
          <input
            type="range"
            min="0"
            max="100"
            value={settings.globalVolume}
            onChange={(e) =>
              handleSettingsUpdate({ globalVolume: Number(e.target.value) })
            }
            style={{ width: 120 }}
          />
          <span style={styles.muted}>{settings.globalVolume}%</span>
        </label>
        <label style={styles.row}>
          <span>Cooldown (sec)</span>
          <input
            type="number"
            min="0"
            max="60"
            value={Math.round(settings.globalCooldownMs / 1000)}
            onChange={(e) =>
              handleSettingsUpdate({
                globalCooldownMs: Number(e.target.value) * 1000,
              })
            }
            style={styles.numberInput}
          />
        </label>
        <label style={styles.row}>
          <span>Max Queue</span>
          <input
            type="number"
            min="1"
            max="20"
            value={settings.maxQueueSize}
            onChange={(e) =>
              handleSettingsUpdate({ maxQueueSize: Number(e.target.value) })
            }
            style={styles.numberInput}
          />
        </label>
      </div>

      {/* Upload Form */}
      <div style={styles.card}>
        <h3 style={styles.subHeading}>Upload Sound</h3>
        <form onSubmit={handleUpload}>
          <div style={{ marginBottom: 8 }}>
            <input
              ref={fileRef}
              type="file"
              accept="audio/mpeg,audio/ogg,audio/wav,audio/webm,audio/mp4"
              style={styles.fileInput}
            />
          </div>
          <div style={{ marginBottom: 8 }}>
            <input
              type="text"
              placeholder="Sound name"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              style={styles.textInput}
              maxLength={100}
            />
          </div>
          <div style={styles.row}>
            <select
              value={newTier}
              onChange={(e) => setNewTier(e.target.value)}
              style={styles.select}
            >
              {(tiers.length ? tiers : Object.keys(TIER_LABELS)).map((t) => (
                <option key={t} value={t}>
                  {TIER_LABELS[t] || t}
                </option>
              ))}
            </select>
            <label style={{ display: "flex", alignItems: "center", gap: 6 }}>
              Vol
              <input
                type="range"
                min="0"
                max="100"
                value={newVolume}
                onChange={(e) => setNewVolume(Number(e.target.value))}
                style={{ width: 80 }}
              />
              <span style={styles.muted}>{newVolume}%</span>
            </label>
          </div>
          <button
            type="submit"
            disabled={uploading}
            style={{
              ...styles.btn,
              marginTop: 8,
              opacity: uploading ? 0.6 : 1,
            }}
          >
            {uploading ? "Uploading..." : "Upload"}
          </button>
        </form>
      </div>

      {/* Sound List */}
      <div style={styles.card}>
        <h3 style={styles.subHeading}>Sounds ({sounds.length}/20)</h3>
        {sounds.length === 0 && (
          <p style={styles.muted}>No sounds uploaded yet.</p>
        )}
        {sounds.map((s) => (
          <SoundRow
            key={s.id}
            sound={s}
            tiers={tiers}
            onToggle={handleToggle}
            onUpdate={handleSoundUpdate}
            onDelete={handleDelete}
          />
        ))}
      </div>
    </div>
  );
}

function SoundRow({ sound, tiers, onToggle, onUpdate, onDelete }) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(sound.name);
  const [tier, setTier] = useState(sound.tier);
  const [volume, setVolume] = useState(sound.volume);

  function save() {
    onUpdate(sound.id, { name, tier, volume });
    setEditing(false);
  }

  return (
    <div style={styles.soundRow}>
      <div style={{ flex: 1, minWidth: 0 }}>
        {editing ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              style={styles.textInput}
              maxLength={100}
            />
            <div style={styles.row}>
              <select
                value={tier}
                onChange={(e) => setTier(e.target.value)}
                style={styles.select}
              >
                {(tiers.length ? tiers : Object.keys(TIER_LABELS)).map((t) => (
                  <option key={t} value={t}>
                    {TIER_LABELS[t] || t}
                  </option>
                ))}
              </select>
              <label
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 4,
                  fontSize: 12,
                }}
              >
                Vol
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={volume}
                  onChange={(e) => setVolume(Number(e.target.value))}
                  style={{ width: 60 }}
                />
                <span>{volume}%</span>
              </label>
            </div>
            <div style={{ display: "flex", gap: 6 }}>
              <button style={styles.btnSmall} onClick={save}>
                Save
              </button>
              <button
                style={{ ...styles.btnSmall, background: "#555" }}
                onClick={() => setEditing(false)}
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <>
            <div style={{ fontWeight: 600, fontSize: 14 }}>{sound.name}</div>
            <div style={{ fontSize: 12, opacity: 0.6 }}>
              {TIER_LABELS[sound.tier] || sound.tier} &middot; Vol{" "}
              {sound.volume}%
            </div>
          </>
        )}
      </div>
      {!editing && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            flexShrink: 0,
          }}
        >
          <input
            type="checkbox"
            checked={sound.enabled}
            onChange={(e) => onToggle(sound.id, e.target.checked)}
            title="Enabled"
          />
          <button style={styles.btnSmall} onClick={() => setEditing(true)}>
            Edit
          </button>
          <button
            style={{ ...styles.btnSmall, background: "#c0392b" }}
            onClick={() => onDelete(sound.id)}
          >
            Del
          </button>
        </div>
      )}
    </div>
  );
}

const styles = {
  container: {
    padding: 12,
    maxWidth: 480,
    margin: "0 auto",
  },
  heading: {
    fontSize: 20,
    fontWeight: 700,
    marginBottom: 12,
  },
  subHeading: {
    fontSize: 15,
    fontWeight: 600,
    marginBottom: 8,
  },
  card: {
    background: "#1f1f23",
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
    border: "1px solid #303038",
  },
  row: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    marginBottom: 6,
    fontSize: 13,
  },
  soundRow: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: "8px 0",
    borderBottom: "1px solid #303038",
  },
  muted: {
    fontSize: 12,
    opacity: 0.6,
  },
  error: {
    background: "#c0392b22",
    border: "1px solid #c0392b",
    borderRadius: 8,
    padding: "8px 12px",
    marginBottom: 10,
    fontSize: 13,
  },
  success: {
    background: "#27ae6022",
    border: "1px solid #27ae60",
    borderRadius: 8,
    padding: "8px 12px",
    marginBottom: 10,
    fontSize: 13,
  },
  textInput: {
    width: "100%",
    padding: "6px 10px",
    borderRadius: 6,
    border: "1px solid #303038",
    background: "#0e0e10",
    color: "#efeff1",
    fontSize: 13,
    outline: "none",
  },
  numberInput: {
    width: 60,
    padding: "4px 6px",
    borderRadius: 6,
    border: "1px solid #303038",
    background: "#0e0e10",
    color: "#efeff1",
    fontSize: 13,
    outline: "none",
  },
  select: {
    padding: "4px 8px",
    borderRadius: 6,
    border: "1px solid #303038",
    background: "#0e0e10",
    color: "#efeff1",
    fontSize: 13,
    outline: "none",
  },
  fileInput: {
    fontSize: 12,
    color: "#efeff1",
  },
  btn: {
    background: "#9146FF",
    color: "#fff",
    border: "none",
    borderRadius: 8,
    padding: "8px 18px",
    fontSize: 14,
    fontWeight: 600,
    cursor: "pointer",
  },
  btnSmall: {
    background: "#9146FF",
    color: "#fff",
    border: "none",
    borderRadius: 6,
    padding: "4px 10px",
    fontSize: 12,
    fontWeight: 600,
    cursor: "pointer",
  },
};

ReactDOM.createRoot(document.getElementById("root")).render(<ConfigApp />);
export default ConfigApp;
