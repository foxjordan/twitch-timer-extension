import { useEffect, useState, useRef, useCallback } from "react";
import ReactDOM from "react-dom/client";
import { setupAnalytics, setAnalyticsAuth, logEvent } from "./firebase.js";
import { BrandedFooter } from "./BrandedFooter.jsx";

const EBS_BASE = import.meta.env.VITE_EBS_BASE || "https://livestreamerhub.com";

// Timestamp (ms since navigation start) when this module started executing —
// close enough to "the panel began loading" to use as the baseline for the
// one-time config_load_timing event below, which exists to find out WHERE
// the "Loading sounds..." delay users report actually goes: Twitch's own
// onAuthorized handshake, or our own /api/sounds round trip.
const moduleEvalAt = performance.now();

// Mirrors ebs/views/theme.js's THEME_CSS_VARS so the Twitch panel uses the
// same design tokens as the livestreamerhub.com dashboard, in both themes.
const THEME_TOKENS = {
  dark: {
    pageBg: "#0e0e10",
    surface: "#1f1f23",
    surfaceBorder: "#303038",
    surfaceMuted: "#151517",
    inputBg: "#151517",
    inputBorder: "#3a3a3d",
    text: "#efeff1",
    textMuted: "rgba(239, 239, 241, 0.8)",
    accent: "#9146ff",
    linkColor: "#bf94ff",
    secondaryBtnBg: "#2c2c31",
    secondaryBtnBorder: "#3a3a3d",
    secondaryBtnText: "#efeff1",
    danger: "#dc2626",
    success: "#10b981",
    warning: "#e67e22",
  },
  light: {
    pageBg: "#f5f5f7",
    surface: "#ffffff",
    surfaceBorder: "#e5e7eb",
    surfaceMuted: "#f3f4f6",
    inputBg: "#ffffff",
    inputBorder: "#d1d5db",
    text: "#111827",
    textMuted: "rgba(17, 24, 39, 0.7)",
    accent: "#9146ff",
    linkColor: "#7c3aed",
    secondaryBtnBg: "#f3f4f6",
    secondaryBtnBorder: "#d1d5db",
    secondaryBtnText: "#1f2937",
    danger: "#dc2626",
    success: "#10b981",
    warning: "#e67e22",
  },
};

import { TIER_LABELS, DEFAULT_TIER } from "./tiers.js";

import { VALID_TIERS } from "./tiers.js";

function getTtsTiers(minTier) {
  const minIdx = VALID_TIERS.indexOf(minTier || "sound_300");
  const startIdx = minIdx >= 0 ? minIdx : 0;
  return VALID_TIERS.slice(startIdx).map((sku) => ({ sku, label: TIER_LABELS[sku] }));
}

function ConfigApp() {
  const [auth, setAuth] = useState(null);
  const [sounds, setSounds] = useState([]);
  const [officialSounds, setOfficialSounds] = useState([]);
  const [addingOfficialId, setAddingOfficialId] = useState(null);
  const [previewingOfficialId, setPreviewingOfficialId] = useState(null);
  const officialPreviewAudioRef = useRef(null);
  const [settings, setSettings] = useState({
    enabled: true,
    globalVolume: 100,
    globalCooldownMs: 3000,
    maxQueueSize: 150,
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
  const [newTier, setNewTier] = useState(DEFAULT_TIER);
  const [newVolume, setNewVolume] = useState(80);
  const [createTab, setCreateTab] = useState("sound");
  const [clipUrl, setClipUrl] = useState("");
  const [overlayUrl, setOverlayUrl] = useState(null);
  const [urlCopied, setUrlCopied] = useState(false);
  const [ttsSettings, setTtsSettings] = useState(null);
  const [ttsVoices, setTtsVoices] = useState([]);
  const [ttsProActive, setTtsProActive] = useState(false);
  const [ttsMinTier, setTtsMinTier] = useState("sound_300");
  const [ttsBannedWordsText, setTtsBannedWordsText] = useState("");
  const [previewingVoice, setPreviewingVoice] = useState(null);
  const [extConfig, setExtConfig] = useState({ features: { tts: true, videoClips: true, communityLibrary: true } });
  const [initialLoadFailed, setInitialLoadFailed] = useState(false);
  const [bannerDismissed, setBannerDismissed] = useState(false);
  const [twitchTheme, setTwitchTheme] = useState("dark");
  const [quickSetupOpen, setQuickSetupOpen] = useState(false);
  const previewAudioRef = useRef(null);

  const t = THEME_TOKENS[twitchTheme] || THEME_TOKENS.dark;
  const styles = buildStyles(t);

  useEffect(() => {
    window.Twitch?.ext?.onContext((context) => {
      if (context?.theme === "light" || context?.theme === "dark") {
        setTwitchTheme(context.theme);
      }
    });
  }, []);

  useEffect(() => {
    document.body.style.background = t.pageBg;
    document.body.style.color = t.text;
  }, [t.pageBg, t.text]);

  const headers = useCallback(
    () => ({
      Authorization: `Bearer ${auth?.token}`,
    }),
    [auth],
  );

  const fetchSounds = useCallback(
    async (token, timing) => {
      const fetchStartAt = performance.now();
      try {
        const res = await fetch(`${EBS_BASE}/api/sounds`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) throw new Error("Failed to fetch sounds");
        const data = await res.json();
        setSounds(data.sounds || []);
        if (data.settings) setSettings(data.settings);
        setTiers(data.tiers || []);
      } catch (e) {
        setError(e.message);
        setInitialLoadFailed(true);
      } finally {
        setLoading(false);
        // Only the initial load (see the onAuthorized handler below) passes
        // `timing` — this reports once per panel open, not on every
        // fetchSounds call site (e.g. not on retry-after-error paths that
        // may call this elsewhere).
        if (timing) {
          const fetchEndAt = performance.now();
          logEvent("config_load_timing", {
            moduleToAuthorizedMs: Math.round(timing.authorizedAt - timing.moduleEvalAt),
            authorizedToFetchStartMs: Math.round(fetchStartAt - timing.authorizedAt),
            fetchDurationMs: Math.round(fetchEndAt - fetchStartAt),
            totalMs: Math.round(fetchEndAt - timing.moduleEvalAt),
          });
        }
      }
    },
    [],
  );

  useEffect(() => {
    setupAnalytics("config");

    window.Twitch?.ext?.onAuthorized((authData) => {
      const authorizedAt = performance.now();
      setAuth(authData);
      setAnalyticsAuth(authData);
      logEvent("config_loaded");
      fetchSounds(authData.token, { moduleEvalAt, authorizedAt });
      fetch(`${EBS_BASE}/api/sounds/overlay-url`, {
        headers: { Authorization: `Bearer ${authData.token}` },
      })
        .then((r) => r.json())
        .then((data) => {
          if (data.url) setOverlayUrl(data.url);
        })
        .catch(() => {});

      // Fetch remote feature config
      fetch(`${EBS_BASE}/api/ext/config?channelId=${authData.channelId}`, {
        headers: { Authorization: `Bearer ${authData.token}` },
      })
        .then((r) => r.json())
        .then((data) => { if (data.features) setExtConfig(data); })
        .catch(() => {});

      // Curated official sounds so new broadcasters have something to add
      // immediately, without leaving the panel. Full browse/search stays
      // dashboard-only — see plan notes on scope. We fetch the whole official
      // pool (not just the first 10) so that once a broadcaster has added
      // one, the panel can slide the next not-yet-owned sound into its place
      // instead of just graying the button out — see the visibleOfficial
      // derivation near the render, which filters+slices to 10 on the fly.
      fetch(`${EBS_BASE}/api/sounds/library`, {
        headers: { Authorization: `Bearer ${authData.token}` },
      })
        .then((r) => r.json())
        .then((data) => {
          const official = (data.sounds || []).filter((s) => s.isOfficial);
          setOfficialSounds(official);
        })
        .catch(() => {});

      // Fetch TTS settings
      fetch(`${EBS_BASE}/api/tts/settings`, {
        headers: { Authorization: `Bearer ${authData.token}` },
      })
        .then((r) => r.json())
        .then((data) => {
          if (data.settings) {
            setTtsSettings(data.settings);
            setTtsBannedWordsText((data.settings.bannedWords || []).join("\n"));
          }
          if (data.voices) setTtsVoices(data.voices);
          if (typeof data.proActive === "boolean") setTtsProActive(data.proActive);
          if (data.minTier) setTtsMinTier(data.minTier);
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
    if (file.size > 5 * 1024 * 1024) return setError("File must be under 5 MB");

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
      setNewTier(DEFAULT_TIER);
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
      setNewTier(DEFAULT_TIER);
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
    if (file.size > 25 * 1024 * 1024)
      return setError("Video must be under 25 MB");

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
      setNewTier(DEFAULT_TIER);
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

  function toggleOfficialPreview(sound) {
    if (officialPreviewAudioRef.current) {
      officialPreviewAudioRef.current.pause();
      officialPreviewAudioRef.current = null;
      const wasPlayingThis = previewingOfficialId === sound.id;
      setPreviewingOfficialId(null);
      if (wasPlayingThis) return;
    }
    setPreviewingOfficialId(sound.id);
    // Get a short-lived token, then fetch the audio bytes as a blob and play
    // via a blob: URL — mirrors playVoicePreview below. Twitch's extension
    // iframe enforces its own CSP media-src that blocks <audio src> pointed
    // directly at a cross-origin (livestreamerhub.com) URL even though the
    // request itself is CORS-permitted; a blob: URL isn't subject to that
    // check since the actual network fetch happens under connect-src.
    fetch(
      `${EBS_BASE}/api/sounds/preview-token/${sound.id}?channelId=${sound.ownerUserId}`,
      { headers: { Authorization: `Bearer ${auth.token}` } },
    )
      .then((r) => {
        if (!r.ok) throw new Error();
        return r.json();
      })
      .then(({ token }) =>
        fetch(
          `${EBS_BASE}/api/sounds/preview/${sound.id}?pt=${encodeURIComponent(token)}&channelId=${sound.ownerUserId}`,
        ),
      )
      .then((r) => {
        if (!r.ok) throw new Error();
        return r.blob();
      })
      .then((blob) => {
        const url = URL.createObjectURL(blob);
        const audio = new Audio(url);
        officialPreviewAudioRef.current = audio;
        audio.onended = () => {
          URL.revokeObjectURL(url);
          officialPreviewAudioRef.current = null;
          setPreviewingOfficialId(null);
        };
        audio.onerror = () => {
          URL.revokeObjectURL(url);
          officialPreviewAudioRef.current = null;
          setPreviewingOfficialId(null);
        };
        audio.play().catch(() => {});
      })
      .catch(() => {
        setPreviewingOfficialId(null);
      });
  }

  async function handleAddOfficialSound(sound) {
    setError(null);
    setAddingOfficialId(sound.id);
    try {
      const res = await fetch(`${EBS_BASE}/api/sounds/library/add`, {
        method: "POST",
        headers: { ...headers(), "Content-Type": "application/json" },
        body: JSON.stringify({ ownerUserId: sound.ownerUserId, soundId: sound.id }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Failed to add sound");
      }
      await fetchSounds(auth.token);
      logEvent("official_sound_added", { soundId: sound.id });
      setOfficialSounds((prev) =>
        prev.map((s) => (s.id === sound.id ? { ...s, owned: true } : s)),
      );
      flash(`Added "${sound.name}"`);
    } catch (e) {
      setError(e.message);
    } finally {
      setAddingOfficialId(null);
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

  async function handleTtsSettingsUpdate(patch) {
    setError(null);
    try {
      const res = await fetch(`${EBS_BASE}/api/tts/settings`, {
        method: "POST",
        headers: { ...headers(), "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "TTS settings update failed");
      }
      const data = await res.json();
      setTtsSettings(data.settings);
      logEvent("tts_settings_updated", patch);
      flash("TTS settings saved");
    } catch (e) {
      setError(e.message);
    }
  }

  async function handleTtsTest() {
    if (!ttsSettings) return;
    setError(null);
    const voice = ttsSettings.allowedVoices?.[0];
    if (!voice) return setError("No voices selected");
    try {
      const res = await fetch(`${EBS_BASE}/api/tts/test`, {
        method: "POST",
        headers: { ...headers(), "Content-Type": "application/json" },
        body: JSON.stringify({ message: "This is a test of text to speech.", voiceId: voice }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "TTS test failed");
      }
      flash("TTS test sent to overlay");
    } catch (e) {
      setError(e.message);
    }
  }

  function playVoicePreview(voiceId) {
    if (previewAudioRef.current) {
      previewAudioRef.current.pause();
      previewAudioRef.current = null;
    }
    if (previewingVoice === voiceId) {
      setPreviewingVoice(null);
      return;
    }
    setPreviewingVoice(voiceId);
    fetch(`${EBS_BASE}/api/tts/preview/${encodeURIComponent(voiceId)}`, {
      headers: headers(),
    })
      .then((r) => {
        if (!r.ok) throw new Error();
        return r.blob();
      })
      .then((blob) => {
        const url = URL.createObjectURL(blob);
        const audio = new Audio(url);
        previewAudioRef.current = audio;
        audio.onended = () => { URL.revokeObjectURL(url); previewAudioRef.current = null; setPreviewingVoice(null); };
        audio.onerror = () => { previewAudioRef.current = null; setPreviewingVoice(null); };
        audio.play().catch(() => {});
      })
      .catch(() => setPreviewingVoice(null));
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

  if (initialLoadFailed) {
    return (
      <div style={styles.container}>
        <div style={styles.error}>
          Error loading the config. Please use{" "}
          <a
            href={`${EBS_BASE}/sounds/config`}
            target="_blank"
            rel="noopener noreferrer"
            style={styles.link}
          >
            Livestreamer Hub
          </a>{" "}
          to manage your sound alerts while we look into this.
        </div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      {extConfig.banner?.enabled && extConfig.banner?.message && !bannerDismissed && (
        <div style={styles.banner}>
          <span style={{ flex: 1 }}>
            {extConfig.banner.message}
            {extConfig.banner.linkUrl && (
              <a
                href={extConfig.banner.linkUrl}
                target="_blank"
                rel="noopener noreferrer"
                style={styles.bannerLink}
              >
                {extConfig.banner.linkText || "Learn more"}
              </a>
            )}
          </span>
          <button
            style={styles.bannerDismiss}
            onClick={() => setBannerDismissed(true)}
            title="Dismiss"
          >
            &times;
          </button>
        </div>
      )}

      <div style={styles.headingRow}>
        <h2 style={styles.heading}>Livestreamer Alerts</h2>
        <a
          href={`${EBS_BASE}/sounds/config?ref=extension`}
          target="_blank"
          rel="noopener noreferrer"
          style={styles.link}
        >
          Manage on Livestreamer Hub &rarr;
        </a>
      </div>

      {/* OBS Overlay URL — pinned near the top since it's the one thing
          broadcasters need before anything else works, and easy to miss
          when it was buried inside the Settings card further down. */}
      {overlayUrl && (
        <div style={{ ...styles.card, marginBottom: 12, padding: "10px 14px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <span style={{ fontSize: 12, fontWeight: 600, flexShrink: 0 }}>OBS Overlay URL</span>
            <div
              style={{
                flex: "1 1 240px",
                minWidth: 0,
                padding: "5px 8px",
                background: t.inputBg,
                borderRadius: 6,
                border: `1px solid ${t.inputBorder}`,
                fontSize: 10,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
                fontFamily: "monospace",
              }}
              title={overlayUrl}
            >
              {overlayUrl}
            </div>
            <button
              style={{ ...styles.btnSmall, flexShrink: 0 }}
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
          <p style={{ margin: "6px 0 0", fontSize: 10, opacity: 0.5 }}>
            Add this as a Browser Source in OBS (1920×1080). Alerts only play while this page is open.
          </p>
        </div>
      )}

      {/* Setup Guide — collapsed by default to save space; the steps rarely
          change once a broadcaster has set up once, so keep it out of the
          way but easy to reopen. */}
      <div style={{ ...styles.card, marginBottom: 12, padding: "8px 14px" }}>
        <button
          onClick={() => setQuickSetupOpen((v) => !v)}
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            width: "100%",
            background: "none",
            border: "none",
            color: t.text,
            cursor: "pointer",
            padding: "4px 0",
            font: "inherit",
          }}
        >
          <h3 style={{ ...styles.subHeading, margin: 0 }}>Quick Setup</h3>
          <span style={{ fontSize: 11, opacity: 0.6, transform: quickSetupOpen ? "rotate(180deg)" : "none", transition: "transform 0.15s" }}>
            &#9660;
          </span>
        </button>
        {quickSetupOpen && (
          <>
            <ol style={{ margin: "8px 0 0", paddingLeft: 18, fontSize: 12, lineHeight: 1.8, opacity: 0.85 }}>
              <li>Copy your <strong>OBS Overlay URL</strong> above into an OBS Browser Source.</li>
              <li>Use <strong>Add New Alert Media</strong> to upload sounds and set their Bits amount.</li>
              <li>Make sure <strong>Enabled</strong> is checked in Settings so the viewer panel shows your alerts.</li>
              <li>Viewers use Bits in your Twitch panel to trigger sounds and TTS on stream.</li>
            </ol>
            <p style={{ margin: "8px 0 0", fontSize: 11, opacity: 0.5 }}>
              The overlay page must be open (in OBS or a browser) for alerts to play. An "Overlay not active" warning appears in the viewer panel when it is not connected.
            </p>
          </>
        )}
      </div>

      {officialSounds.some((s) => !s.owned) && (
        <div style={{ ...styles.card, marginBottom: 12 }}>
          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 8 }}>
            <h3 style={styles.subHeading}>Popular Sound Alerts</h3>
            <a
              href={`${EBS_BASE}/sounds/config#library`}
              target="_blank"
              rel="noopener noreferrer"
              style={styles.link}
            >
              Find more on Livestreamer Hub &rarr;
            </a>
          </div>
          <p style={{ margin: "0 0 10px", fontSize: 11, opacity: 0.6 }}>
            A few ready-made alerts to get you started — add any of these instantly, no files needed.
          </p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {officialSounds
              .filter((s) => !s.owned)
              .slice(0, 10)
              .map((s) => (
                <div
                  key={s.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    padding: "6px 10px",
                    borderRadius: 8,
                    background: t.surfaceMuted,
                    border: `1px solid ${t.surfaceBorder}`,
                    fontSize: 12,
                  }}
                >
                  <button
                    title="Preview"
                    onClick={() => toggleOfficialPreview(s)}
                    style={{
                      ...styles.btnSmall,
                      background: "transparent",
                      border: `1px solid ${t.surfaceBorder}`,
                      color: t.text,
                      padding: "3px 7px",
                      lineHeight: 1,
                    }}
                  >
                    {previewingOfficialId === s.id ? "■" : "▶"}
                  </button>
                  <span>{s.name}</span>
                  <button
                    style={{
                      ...styles.btnSmall,
                      background: t.accent,
                      color: "#fff",
                      padding: "3px 8px",
                    }}
                    disabled={addingOfficialId === s.id}
                    onClick={() => handleAddOfficialSound(s)}
                  >
                    {addingOfficialId === s.id ? "Adding..." : "+ Add"}
                  </button>
                </div>
              ))}
          </div>
        </div>
      )}

      {error && <div style={styles.error}>{error}</div>}
      {success && <div style={styles.success}>{success}</div>}

      {/* Add New Alert Media */}
      <div style={styles.card}>
        <h3 style={styles.subHeading}>Add New Alert Media</h3>
        {/* Tabs */}
        <div style={{ display: "flex", gap: 4, marginBottom: 10 }}>
          {[
            { key: "sound", label: "Sound" },
            ...(settings.videoClipsEnabled
              ? [
                  { key: "clip", label: "Twitch Clip" },
                  { key: "video", label: "Video" },
                ]
              : []),
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setCreateTab(tab.key)}
              style={{
                ...styles.btnSmall,
                background: createTab === tab.key ? t.accent : t.surfaceBorder,
                opacity: createTab === tab.key ? 1 : 0.7,
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>
        {!settings.videoClipsEnabled && (
          <div style={{ fontSize: 11, opacity: 0.5, marginBottom: 8 }}>
            Video &amp; clip alerts are a Pro feature.
          </div>
        )}

        {/* Sound tab */}
        {createTab === "sound" && (
          <form onSubmit={handleUpload}>
            <div style={{ fontSize: 11, opacity: 0.5, marginBottom: 8 }}>
              Max 5 MB. Accepted: MP3, OGG, WAV, WebM, M4A.
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
              style={{
                ...styles.btn,
                marginTop: 8,
                opacity: uploading ? 0.6 : 1,
              }}
            >
              {uploading ? "Uploading..." : "Upload Sound"}
            </button>
          </form>
        )}

        {/* Clip tab */}
        {createTab === "clip" && (
          <form onSubmit={handleClipCreate}>
            <div style={{ fontSize: 11, opacity: 0.5, marginBottom: 8 }}>
              Paste a Twitch Clip URL. The clip will play in the OBS overlay
              when redeemed.
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
              style={{
                ...styles.btn,
                marginTop: 8,
                opacity: uploading ? 0.6 : 1,
              }}
            >
              {uploading ? "Creating..." : "Add Clip"}
            </button>
          </form>
        )}

        {/* Video tab */}
        {createTab === "video" && (
          <form onSubmit={handleVideoUpload}>
            <div style={{ fontSize: 11, opacity: 0.5, marginBottom: 8 }}>
              Max 25 MB. Accepted: MP4, WebM.
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
              style={{
                ...styles.btn,
                marginTop: 8,
                opacity: uploading ? 0.6 : 1,
              }}
            >
              {uploading ? "Uploading..." : "Upload Video"}
            </button>
          </form>
        )}
      </div>

      {/* Alerts List — full width */}
      <div style={styles.card}>
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
          <h3 style={styles.subHeading}>Your Alerts ({sounds.length}/20)</h3>
          <a
            href={`${EBS_BASE}/sounds/config#activity`}
            target="_blank"
            rel="noopener noreferrer"
            style={{ ...styles.link, marginBottom: 10 }}
          >
            View Activity &rarr;
          </a>
        </div>
        <p style={{ margin: "0 0 10px", fontSize: 11, opacity: 0.6 }}>
          These are the alerts shown to your viewers. Uncheck one to hide it without deleting it.
        </p>
        {sounds.length === 0 && (
          <p style={styles.muted}>No alerts created yet.</p>
        )}
        {sounds.map((s) => (
          <SoundRow
            key={s.id}
            sound={s}
            tiers={tiers}
            auth={auth}
            styles={styles}
            t={t}
            onToggle={handleToggle}
            onUpdate={handleSoundUpdate}
            onDelete={handleDelete}
            onSuccess={flash}
            onError={setError}
            onRefresh={() => fetchSounds(auth.token)}
          />
        ))}
      </div>

      {/* General Settings — thin horizontal row, kept toward the bottom since
          broadcasters set these once and rarely revisit them. */}
      <div style={{ ...styles.card, padding: "10px 14px" }}>
        <h3 style={{ ...styles.subHeading, marginBottom: 8 }}>Settings</h3>
        <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 16 }}>
          <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12 }}>
            <input
              type="checkbox"
              checked={settings.enabled}
              onChange={(e) =>
                handleSettingsUpdate({ enabled: e.target.checked })
              }
            />
            Enabled
          </label>
          <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12 }}>
            Global Volume
            <input
              type="range"
              min="0"
              max="100"
              value={settings.globalVolume}
              onChange={(e) =>
                handleSettingsUpdate({ globalVolume: Number(e.target.value) })
              }
              style={{ width: 90 }}
            />
            <span style={styles.muted}>{settings.globalVolume}%</span>
          </label>
          <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12 }}>
            Cooldown (sec)
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
          <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12 }}>
            Max Queue
            <input
              type="number"
              min="1"
              max="200"
              value={settings.maxQueueSize}
              onChange={(e) =>
                handleSettingsUpdate({ maxQueueSize: Number(e.target.value) })
              }
              style={styles.numberInput}
            />
          </label>
        </div>
      </div>

      {/* Row 3: TTS Settings — full width */}
      {ttsSettings && (
        <div style={styles.card}>
          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
            <h3 style={styles.subHeading}>TTS Settings</h3>
            <a
              href={`${EBS_BASE}/sounds/config#queue`}
              target="_blank"
              rel="noopener noreferrer"
              style={{ ...styles.link, marginBottom: 10 }}
            >
              View Alert Queue &rarr;
            </a>
          </div>
          {!ttsProActive && !ttsSettings.granted && (
            <div style={{ fontSize: 11, opacity: 0.5, marginBottom: 8 }}>
              TTS alerts require a Pro plan or admin grant.
            </div>
          )}

          {/* TTS two-column grid for controls */}
          <div style={styles.ttsGrid}>
            <div>
              <label style={styles.row}>
                <span>Enabled</span>
                <input
                  type="checkbox"
                  checked={ttsSettings.enabled}
                  disabled={!ttsProActive && !ttsSettings.granted}
                  onChange={(e) =>
                    handleTtsSettingsUpdate({ enabled: e.target.checked })
                  }
                />
              </label>
              <label style={styles.row}>
                <span>Bits Amount</span>
                <select
                  value={ttsSettings.tier}
                  onChange={(e) => handleTtsSettingsUpdate({ tier: e.target.value })}
                  style={styles.select}
                >
                  {getTtsTiers(ttsMinTier).map((t) => (
                    <option key={t.sku} value={t.sku}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </label>
              <label style={styles.row}>
                <span>Volume</span>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={ttsSettings.volume}
                  onChange={(e) =>
                    handleTtsSettingsUpdate({ volume: Number(e.target.value) })
                  }
                  style={{ width: 120 }}
                />
                <span style={styles.muted}>{ttsSettings.volume}%</span>
              </label>
              <label style={styles.row}>
                <span>Cooldown (sec)</span>
                <input
                  type="number"
                  min="0"
                  max="120"
                  value={Math.round(ttsSettings.cooldownMs / 1000)}
                  onChange={(e) =>
                    handleTtsSettingsUpdate({
                      cooldownMs: Number(e.target.value) * 1000,
                    })
                  }
                  style={styles.numberInput}
                />
              </label>
              <label style={styles.row}>
                <span>Max Message Length</span>
                <input
                  type="number"
                  min="1"
                  max="300"
                  value={ttsSettings.maxMessageLength}
                  onChange={(e) =>
                    handleTtsSettingsUpdate({ maxMessageLength: Number(e.target.value) })
                  }
                  style={styles.numberInput}
                />
              </label>
              <label style={styles.row}>
                <span>Content Moderation</span>
                <input
                  type="checkbox"
                  checked={ttsSettings.moderationEnabled}
                  onChange={(e) =>
                    handleTtsSettingsUpdate({ moderationEnabled: e.target.checked })
                  }
                />
              </label>
              {!ttsSettings.moderationEnabled && (
                <div style={{ fontSize: 11, color: t.warning, marginBottom: 6, marginTop: -4 }}>
                  Disabling moderation may allow offensive messages. Banned words are still checked.
                </div>
              )}
              <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                <button
                  style={styles.btn}
                  onClick={handleTtsTest}
                >
                  Test TTS
                </button>
              </div>
            </div>

            <div>
              <div style={{ marginBottom: 10 }}>
                <div style={{ fontSize: 13, marginBottom: 6, fontWeight: 500 }}>Available Voices</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {ttsVoices.map((v) => (
                    <label
                      key={v.id}
                      style={{ fontSize: 12, display: "flex", alignItems: "center", gap: 4 }}
                    >
                      <input
                        type="checkbox"
                        checked={ttsSettings.allowedVoices.includes(v.id)}
                        onChange={(e) => {
                          const next = e.target.checked
                            ? [...ttsSettings.allowedVoices, v.id]
                            : ttsSettings.allowedVoices.filter((x) => x !== v.id);
                          if (next.length > 0) handleTtsSettingsUpdate({ allowedVoices: next });
                        }}
                      />
                      {v.name}
                      <button
                        type="button"
                        onClick={(e) => { e.preventDefault(); playVoicePreview(v.id); }}
                        style={{ background: "none", border: "1px solid #555", borderRadius: 4, padding: "0 4px", fontSize: 10, cursor: "pointer", color: previewingVoice === v.id ? "#9146ff" : "#aaa", lineHeight: 1.4 }}
                        title={`Preview ${v.name}`}
                      >
                        {previewingVoice === v.id ? "\u23F9" : "\u25B6"}
                      </button>
                    </label>
                  ))}
                </div>
              </div>
              <label style={{ display: "block" }}>
                <div style={{ fontSize: 13, marginBottom: 4, fontWeight: 500 }}>Banned Words (one per line)</div>
                <textarea
                  value={ttsBannedWordsText}
                  onChange={(e) => setTtsBannedWordsText(e.target.value)}
                  onBlur={() => {
                    const words = ttsBannedWordsText
                      .split("\n")
                      .map((w) => w.trim())
                      .filter(Boolean);
                    handleTtsSettingsUpdate({ bannedWords: words });
                  }}
                  rows={4}
                  style={{ ...styles.textInput, resize: "vertical" }}
                  placeholder={"badword1\nbadword2"}
                />
              </label>
            </div>
          </div>
        </div>
      )}
      <BrandedFooter style={{ marginTop: 16, paddingBottom: 8 }} />
    </div>
  );
}

function SoundRow({
  sound,
  tiers,
  auth,
  styles,
  t,
  onToggle,
  onUpdate,
  onDelete,
  onRefresh,
  onSuccess,
  onError,
}) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(sound.name);
  const [tier, setTier] = useState(sound.tier);
  const [volume, setVolume] = useState(sound.volume);
  const [editClipUrl, setEditClipUrl] = useState(sound.clipUrl || "");
  const [imageUploading, setImageUploading] = useState(false);
  const [imagePreviewUrl, setImagePreviewUrl] = useState(null);
  const [previewing, setPreviewing] = useState(false);
  const [testing, setTesting] = useState(false);
  const soundAudioRef = useRef(null);
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
    } catch {
    } finally {
      setImageUploading(false);
    }
  }

  async function handleImageDelete() {
    await fetch(`${EBS_BASE}/api/sounds/${sound.id}/image`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${auth.token}` },
    }).catch(() => {});
    setImagePreviewUrl(null);
    onRefresh();
  }

  function togglePreview() {
    if (soundAudioRef.current) {
      soundAudioRef.current.pause();
      soundAudioRef.current = null;
      setPreviewing(false);
      return;
    }
    setPreviewing(true);
    // Get a short-lived preview token, then fetch the audio bytes as a blob
    // and play via a blob: URL (mirrors playVoicePreview in the parent
    // component). Twitch's extension iframe enforces its own CSP media-src
    // that blocks <audio src> pointed directly at a cross-origin
    // (livestreamerhub.com) URL even when the request itself is
    // CORS-permitted; a blob: URL sidesteps that since the network fetch
    // happens under connect-src instead.
    fetch(
      `${EBS_BASE}/api/sounds/preview-token/${sound.id}?channelId=${auth.channelId}`,
      { headers: { Authorization: `Bearer ${auth.token}` } },
    )
      .then((r) => {
        if (!r.ok) throw new Error();
        return r.json();
      })
      .then(({ token }) =>
        fetch(
          `${EBS_BASE}/api/sounds/preview/${sound.id}?pt=${encodeURIComponent(token)}&channelId=${auth.channelId}`,
        ),
      )
      .then((r) => {
        if (!r.ok) throw new Error();
        return r.blob();
      })
      .then((blob) => {
        const url = URL.createObjectURL(blob);
        const audio = new Audio(url);
        soundAudioRef.current = audio;
        audio.onended = () => {
          URL.revokeObjectURL(url);
          soundAudioRef.current = null;
          setPreviewing(false);
        };
        audio.onerror = () => {
          URL.revokeObjectURL(url);
          soundAudioRef.current = null;
          setPreviewing(false);
          onError?.("Preview failed");
        };
        audio.play().catch(() => {});
      })
      .catch(() => {
        setPreviewing(false);
        onError?.("Preview failed");
      });
  }

  async function handleTest() {
    setTesting(true);
    try {
      const statusRes = await fetch(
        `${EBS_BASE}/api/overlay/status?channelId=${auth.channelId}`,
      );
      const statusData = await statusRes.json().catch(() => ({}));
      if (!statusData.connected) {
        onError?.("Overlay not connected — open your OBS browser source or overlay page first.");
        return;
      }
      const res = await fetch(`${EBS_BASE}/api/sounds/test/${sound.id}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${auth.token}` },
      });
      if (!res.ok) throw new Error();
      onSuccess?.("Sent to overlay!");
    } catch {
      onError?.("Test failed");
    } finally {
      setTesting(false);
    }
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
          background: t.inputBg,
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
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{ opacity: 0.3 }}
          >
            <rect x="2" y="2" width="20" height="20" rx="2.18" ry="2.18" />
            <line x1="7" y1="2" x2="7" y2="22" />
            <line x1="17" y1="2" x2="17" y2="22" />
            <line x1="2" y1="12" x2="22" y2="12" />
          </svg>
        ) : soundType === "video" ? (
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{ opacity: 0.3 }}
          >
            <polygon points="23 7 16 12 23 17 23 7" />
            <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
          </svg>
        ) : (
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{ opacity: 0.3 }}
          >
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
                    style={{ ...styles.btnSmall, background: t.danger }}
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
                style={styles.btnSecondary}
                onClick={() => setEditing(false)}
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <>
            <div
              style={{
                fontWeight: 600,
                fontSize: 14,
                display: "flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              {sound.name}
              {soundType !== "sound" && (
                <span
                  style={{
                    fontSize: 10,
                    padding: "1px 5px",
                    borderRadius: 4,
                    background: soundType === "clip" ? "#2d7d46" : "#2d5a7d",
                    fontWeight: 500,
                    textTransform: "uppercase",
                  }}
                >
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
          <label
            style={{ display: "flex", alignItems: "center", gap: 3, fontSize: 11, opacity: 0.8, cursor: "pointer" }}
            title="Show this alert to viewers"
          >
            <input
              type="checkbox"
              checked={sound.enabled}
              onChange={(e) => onToggle(sound.id, e.target.checked)}
            />
            Show
          </label>
          <button style={styles.btnSmall} onClick={() => setEditing(true)}>
            Edit
          </button>
          {soundType === "sound" && (
            <button style={styles.btnSecondary} onClick={togglePreview}>
              {previewing ? "■ Stop" : "Preview"}
            </button>
          )}
          <button style={styles.btnSecondary} disabled={testing} onClick={handleTest}>
            {testing ? "Testing..." : "Test"}
          </button>
          <button
            style={{ ...styles.btnSmall, background: t.danger }}
            onClick={() => onDelete(sound.id)}
          >
            Del
          </button>
        </div>
      )}
    </div>
  );
}

function buildStyles(t) {
  return {
    container: {
      padding: "16px 24px",
      maxWidth: 900,
      margin: "0 auto",
    },
    headingRow: {
      display: "flex",
      alignItems: "baseline",
      justifyContent: "space-between",
      flexWrap: "wrap",
      gap: 8,
      marginBottom: 16,
    },
    heading: {
      fontSize: 22,
      fontWeight: 700,
      margin: 0,
    },
    link: {
      color: t.linkColor,
      fontSize: 12,
      textDecoration: "none",
    },
    banner: {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 10,
      background: `${t.accent}22`,
      border: `1px solid ${t.accent}`,
      borderRadius: 8,
      padding: "8px 12px",
      marginBottom: 14,
      fontSize: 13,
    },
    bannerDismiss: {
      background: "none",
      border: "none",
      color: t.text,
      fontSize: 16,
      lineHeight: 1,
      cursor: "pointer",
      opacity: 0.7,
      flexShrink: 0,
    },
    bannerLink: {
      color: t.linkColor,
      fontWeight: 600,
      textDecoration: "underline",
      marginLeft: 8,
      whiteSpace: "nowrap",
    },
    subHeading: {
      fontSize: 15,
      fontWeight: 600,
      marginBottom: 10,
    },
    twoCol: {
      display: "grid",
      gridTemplateColumns: "1fr 1fr",
      gap: 14,
      marginBottom: 14,
    },
    ttsGrid: {
      display: "grid",
      gridTemplateColumns: "1fr 1fr",
      gap: 20,
    },
    card: {
      background: t.surface,
      borderRadius: 14,
      padding: 20,
      marginBottom: 14,
      border: `1px solid ${t.surfaceBorder}`,
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
      borderBottom: `1px solid ${t.surfaceBorder}`,
    },
    muted: {
      fontSize: 12,
      opacity: 0.6,
    },
    error: {
      background: `${t.danger}22`,
      border: `1px solid ${t.danger}`,
      borderRadius: 8,
      padding: "8px 12px",
      marginBottom: 12,
      fontSize: 13,
    },
    success: {
      background: `${t.success}22`,
      border: `1px solid ${t.success}`,
      borderRadius: 8,
      padding: "8px 12px",
      marginBottom: 12,
      fontSize: 13,
    },
    textInput: {
      width: "100%",
      padding: "6px 10px",
      borderRadius: 6,
      border: `1px solid ${t.inputBorder}`,
      background: t.inputBg,
      color: t.text,
      fontSize: 13,
      outline: "none",
      boxSizing: "border-box",
    },
    numberInput: {
      width: 60,
      padding: "4px 6px",
      borderRadius: 6,
      border: `1px solid ${t.inputBorder}`,
      background: t.inputBg,
      color: t.text,
      fontSize: 13,
      outline: "none",
    },
    select: {
      padding: "4px 8px",
      borderRadius: 6,
      border: `1px solid ${t.inputBorder}`,
      background: t.inputBg,
      color: t.text,
      fontSize: 13,
      outline: "none",
    },
    fileInput: {
      fontSize: 12,
      color: t.text,
    },
    btn: {
      background: t.accent,
      color: "#fff",
      border: "none",
      borderRadius: 8,
      padding: "8px 18px",
      fontSize: 14,
      fontWeight: 600,
      cursor: "pointer",
    },
    btnSmall: {
      background: t.accent,
      color: "#fff",
      border: "none",
      borderRadius: 6,
      padding: "4px 10px",
      fontSize: 12,
      fontWeight: 600,
      cursor: "pointer",
    },
    btnSecondary: {
      background: t.secondaryBtnBg,
      color: t.secondaryBtnText,
      border: `1px solid ${t.secondaryBtnBorder}`,
      borderRadius: 6,
      padding: "4px 10px",
      fontSize: 12,
      fontWeight: 600,
      cursor: "pointer",
    },
  };
}

ReactDOM.createRoot(document.getElementById("root")).render(<ConfigApp />);
export default ConfigApp;
