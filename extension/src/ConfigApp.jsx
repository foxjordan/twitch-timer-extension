import { useEffect, useState, useRef, useCallback } from "react";
import ReactDOM from "react-dom/client";
import { setupAnalytics, logEvent } from "./firebase.js";

const EBS_BASE = import.meta.env.VITE_EBS_BASE || "https://livestreamerhub.com";

const TIER_LABELS = {
  sound_10: "10 Bits",
  sound_25: "25 Bits",
  sound_50: "50 Bits",
  sound_75: "75 Bits",
  sound_100: "100 Bits",
  sound_150: "150 Bits",
  sound_200: "200 Bits",
  sound_250: "250 Bits",
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
  const videoFileRef = useRef(null);
  const [newName, setNewName] = useState("");
  const [newTier, setNewTier] = useState("sound_100");
  const [newVolume, setNewVolume] = useState(80);
  const [createTab, setCreateTab] = useState("sound");
  const [clipUrl, setClipUrl] = useState("");
  const [overlayUrl, setOverlayUrl] = useState(null);
  const [urlCopied, setUrlCopied] = useState(false);

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
    setupAnalytics();

    window.Twitch?.ext?.onAuthorized((authData) => {
      setAuth(authData);
      logEvent("config_loaded");
      fetchSounds(authData.token);
      fetch(`${EBS_BASE}/api/sounds/overlay-url`, {
        headers: { Authorization: `Bearer ${authData.token}` },
      })
        .then((r) => r.json())
        .then((data) => {
          if (data.url) setOverlayUrl(data.url);
        })
        .catch(() => {});
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
      logEvent("sound_uploaded", { tier: newTier });
      setNewName("");
      setNewTier("sound_100");
      setNewVolume(80);
      if (fileRef.current) fileRef.current.value = "";
      flash("Sound uploaded");
    } catch (e) {
      setError(e.message);
    } finally {
      setUploading(false);
    }
  }

  async function handleClipCreate(e) {
    e.preventDefault();
    setError(null);
    if (!clipUrl.trim()) return setError("Enter a Twitch Clip URL");

    setUploading(true);
    try {
      const res = await fetch(`${EBS_BASE}/api/sounds/clip`, {
        method: "POST",
        headers: { ...headers(), "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newName || "Clip",
          clipUrl: clipUrl.trim(),
          tier: newTier,
          volume: newVolume,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Failed to create clip alert");
      }
      await fetchSounds(auth.token);
      logEvent("clip_created", { tier: newTier });
      setNewName("");
      setClipUrl("");
      setNewTier("sound_100");
      setNewVolume(80);
      flash("Clip alert created");
    } catch (e) {
      setError(e.message);
    } finally {
      setUploading(false);
    }
  }

  async function handleVideoUpload(e) {
    e.preventDefault();
    setError(null);
    const file = videoFileRef.current?.files?.[0];
    if (!file) return setError("Select a video file");
    if (file.size > 10 * 1024 * 1024) return setError("Video must be under 10 MB");

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("name", newName || file.name.replace(/\.[^.]+$/, ""));
      formData.append("tier", newTier);
      formData.append("volume", String(newVolume));

      const res = await fetch(`${EBS_BASE}/api/sounds/video`, {
        method: "POST",
        headers: headers(),
        body: formData,
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Video upload failed");
      }
      await fetchSounds(auth.token);
      logEvent("video_uploaded", { tier: newTier });
      setNewName("");
      setNewTier("sound_100");
      setNewVolume(80);
      if (videoFileRef.current) videoFileRef.current.value = "";
      flash("Video uploaded");
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
      logEvent("sound_deleted");
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
      logEvent("settings_updated", patch);
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
      <h2 style={styles.heading}>Alerts</h2>

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

      {/* Create Alert */}
      <div style={styles.card}>
        <h3 style={styles.subHeading}>Create Alert</h3>
        {/* Tabs */}
        <div style={{ display: "flex", gap: 4, marginBottom: 10 }}>
          {[
            { key: "sound", label: "Sound" },
            { key: "clip", label: "Twitch Clip" },
            { key: "video", label: "Video" },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setCreateTab(tab.key)}
              style={{
                ...styles.btnSmall,
                background: createTab === tab.key ? "#9146FF" : "#303038",
                opacity: createTab === tab.key ? 1 : 0.7,
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Sound tab */}
        {createTab === "sound" && (
          <form onSubmit={handleUpload}>
            <div style={{ fontSize: 11, opacity: 0.5, marginBottom: 8 }}>
              Max 1 MB. Accepted: MP3, OGG, WAV, WebM, M4A.
            </div>
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
              style={{ ...styles.btn, marginTop: 8, opacity: uploading ? 0.6 : 1 }}
            >
              {uploading ? "Uploading..." : "Upload Sound"}
            </button>
          </form>
        )}

        {/* Clip tab */}
        {createTab === "clip" && (
          <form onSubmit={handleClipCreate}>
            <div style={{ fontSize: 11, opacity: 0.5, marginBottom: 8 }}>
              Paste a Twitch Clip URL. The clip will play in the OBS overlay when redeemed.
            </div>
            <div style={{ marginBottom: 8 }}>
              <input
                type="text"
                placeholder="https://clips.twitch.tv/..."
                value={clipUrl}
                onChange={(e) => setClipUrl(e.target.value)}
                style={styles.textInput}
              />
            </div>
            <div style={{ marginBottom: 8 }}>
              <input
                type="text"
                placeholder="Alert name"
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
              style={{ ...styles.btn, marginTop: 8, opacity: uploading ? 0.6 : 1 }}
            >
              {uploading ? "Creating..." : "Add Clip"}
            </button>
          </form>
        )}

        {/* Video tab */}
        {createTab === "video" && (
          <form onSubmit={handleVideoUpload}>
            <div style={{ fontSize: 11, opacity: 0.5, marginBottom: 8 }}>
              Max 10 MB. Accepted: MP4, WebM.
            </div>
            <div style={{ marginBottom: 8 }}>
              <input
                ref={videoFileRef}
                type="file"
                accept="video/mp4,video/webm"
                style={styles.fileInput}
              />
            </div>
            <div style={{ marginBottom: 8 }}>
              <input
                type="text"
                placeholder="Video name"
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
              style={{ ...styles.btn, marginTop: 8, opacity: uploading ? 0.6 : 1 }}
            >
              {uploading ? "Uploading..." : "Upload Video"}
            </button>
          </form>
        )}
      </div>

      {/* Alert List */}
      <div style={styles.card}>
        <h3 style={styles.subHeading}>Alerts ({sounds.length}/20)</h3>
        {sounds.length === 0 && (
          <p style={styles.muted}>No alerts created yet.</p>
        )}
        {sounds.map((s) => (
          <SoundRow
            key={s.id}
            sound={s}
            tiers={tiers}
            auth={auth}
            onToggle={handleToggle}
            onUpdate={handleSoundUpdate}
            onDelete={handleDelete}
            onRefresh={() => fetchSounds(auth.token)}
          />
        ))}
      </div>

      {/* OBS Overlay URL */}
      {overlayUrl && (
        <div style={styles.card}>
          <h3 style={styles.subHeading}>OBS Browser Source</h3>
          <p style={{ fontSize: 12, opacity: 0.7, marginBottom: 8 }}>
            Add this URL as a Browser Source in OBS to play sound alerts on
            stream.
          </p>
          <div
            style={{
              padding: "8px 10px",
              background: "#0e0e10",
              borderRadius: 6,
              border: "1px solid #303038",
              fontSize: 11,
              wordBreak: "break-all",
              fontFamily: "monospace",
              marginBottom: 8,
            }}
          >
            {overlayUrl}
          </div>
          <button
            style={styles.btn}
            onClick={() => {
              navigator.clipboard
                .writeText(overlayUrl)
                .then(() => {
                  setUrlCopied(true);
                  setTimeout(() => setUrlCopied(false), 2000);
                })
                .catch(() => {});
            }}
          >
            {urlCopied ? "Copied!" : "Copy URL"}
          </button>
        </div>
      )}
    </div>
  );
}

function SoundRow({ sound, tiers, auth, onToggle, onUpdate, onDelete, onRefresh }) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(sound.name);
  const [tier, setTier] = useState(sound.tier);
  const [volume, setVolume] = useState(sound.volume);
  const [editClipUrl, setEditClipUrl] = useState(sound.clipUrl || "");
  const [imageUploading, setImageUploading] = useState(false);
  const [imagePreviewUrl, setImagePreviewUrl] = useState(null);
  const imageInputRef = useRef(null);
  const soundType = sound.type || "sound";

  useEffect(() => {
    if (!sound.imageFilename || !auth) return;
    let revoked = false;
    let blobUrl;
    fetch(`${EBS_BASE}/api/sounds/${sound.id}/image`, {
      headers: { Authorization: `Bearer ${auth.token}` },
    })
      .then((r) => (r.ok ? r.blob() : null))
      .then((blob) => {
        if (blob && !revoked) {
          blobUrl = URL.createObjectURL(blob);
          setImagePreviewUrl(blobUrl);
        }
      })
      .catch(() => {});
    return () => {
      revoked = true;
      if (blobUrl) URL.revokeObjectURL(blobUrl);
    };
  }, [sound.imageFilename, sound.id, auth?.token]);

  function save() {
    const patch = { name, tier, volume };
    if (soundType === "clip") patch.clipUrl = editClipUrl;
    onUpdate(sound.id, patch);
    setEditing(false);
  }

  async function handleImageUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 256 * 1024) return;

    setImageUploading(true);
    try {
      const formData = new FormData();
      formData.append("image", file);
      const res = await fetch(`${EBS_BASE}/api/sounds/${sound.id}/image`, {
        method: "POST",
        headers: { Authorization: `Bearer ${auth.token}` },
        body: formData,
      });
      if (!res.ok) throw new Error("Upload failed");
      onRefresh();
    } catch {}
    finally { setImageUploading(false); }
  }

  async function handleImageDelete() {
    await fetch(`${EBS_BASE}/api/sounds/${sound.id}/image`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${auth.token}` },
    }).catch(() => {});
    setImagePreviewUrl(null);
    onRefresh();
  }

  return (
    <div style={styles.soundRow}>
      {/* Image thumbnail */}
      <div
        style={{
          width: 40,
          height: 40,
          borderRadius: 6,
          overflow: "hidden",
          flexShrink: 0,
          background: "#0e0e10",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {imagePreviewUrl ? (
          <img
            src={imagePreviewUrl}
            alt=""
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
          />
        ) : soundType === "clip" ? (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.3 }}>
            <rect x="2" y="2" width="20" height="20" rx="2.18" ry="2.18" />
            <line x1="7" y1="2" x2="7" y2="22" />
            <line x1="17" y1="2" x2="17" y2="22" />
            <line x1="2" y1="12" x2="22" y2="12" />
          </svg>
        ) : soundType === "video" ? (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.3 }}>
            <polygon points="23 7 16 12 23 17 23 7" />
            <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
          </svg>
        ) : (
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.3 }}>
            <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
            <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
          </svg>
        )}
      </div>
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
            {soundType === "clip" && (
              <input
                type="text"
                placeholder="Clip URL"
                value={editClipUrl}
                onChange={(e) => setEditClipUrl(e.target.value)}
                style={styles.textInput}
              />
            )}
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
            {/* Image upload */}
            <div>
              <label style={{ fontSize: 11, opacity: 0.6 }}>
                Card Image (max 256 KB)
              </label>
              <div
                style={{
                  display: "flex",
                  gap: 6,
                  alignItems: "center",
                  marginTop: 4,
                }}
              >
                <input
                  ref={imageInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/gif,image/webp"
                  onChange={handleImageUpload}
                  style={{ fontSize: 11, flex: 1 }}
                  disabled={imageUploading}
                />
                {sound.imageFilename && (
                  <button
                    style={{ ...styles.btnSmall, background: "#c0392b" }}
                    onClick={handleImageDelete}
                  >
                    Remove
                  </button>
                )}
              </div>
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
            <div style={{ fontWeight: 600, fontSize: 14, display: "flex", alignItems: "center", gap: 6 }}>
              {sound.name}
              {soundType !== "sound" && (
                <span style={{
                  fontSize: 10,
                  padding: "1px 5px",
                  borderRadius: 4,
                  background: soundType === "clip" ? "#2d7d46" : "#2d5a7d",
                  fontWeight: 500,
                  textTransform: "uppercase",
                }}>
                  {soundType}
                </span>
              )}
            </div>
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
