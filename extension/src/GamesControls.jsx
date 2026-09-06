import { useEffect, useState, useCallback } from "react";
import { VALID_TIERS, TIER_LABELS } from "./tiers.js";

const EBS_BASE = import.meta.env.VITE_EBS_BASE || "https://livestreamerhub.com";

// Shared dark-theme <select> styling — replaces the browser-default white
// dropdown (jarring against the rest of the panel's dark UI) with something
// that matches the app's actual palette. Reused by the Bits-tier picker
// below and by Plinko's column picker.
const selectStyle = {
  width: "100%",
  boxSizing: "border-box",
  padding: "8px 10px",
  borderRadius: 8,
  background: "#303038",
  border: "1px solid #46464f",
  color: "#efeff1",
  fontSize: 13,
  marginBottom: 8,
  appearance: "none",
  WebkitAppearance: "none",
  backgroundImage:
    "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='10' height='6'><path d='M0 0l5 6 5-6z' fill='%23efeff1'/></svg>\")",
  backgroundRepeat: "no-repeat",
  backgroundPosition: "right 10px center",
};

// Shared "play" button (Drop Token / Spin) — a subtle gradient instead of
// flat purple, matching the gradient already used for the header avatar dot
// in App.jsx/ComponentApp.jsx.
function playButtonStyle(disabled) {
  return {
    width: "100%",
    padding: "9px 0",
    borderRadius: 8,
    border: "none",
    fontSize: 13,
    fontWeight: 700,
    cursor: disabled ? "default" : "pointer",
    background: "linear-gradient(135deg, #9146FF, #772CE8)",
    color: "#fff",
    opacity: disabled ? 0.5 : 1,
    boxShadow: disabled ? "none" : "0 2px 8px #9146ff33",
  };
}

// One icon-toggle card in the Plinko/Slots game switcher.
function gameToggleStyle(active) {
  return {
    flex: 1,
    textAlign: "center",
    padding: "10px 4px",
    borderRadius: 10,
    border: "none",
    cursor: "pointer",
    color: "#fff",
    background: active ? "#9146FF22" : "#26262b",
    boxShadow: active ? "0 0 0 1.5px #9146FF inset" : "none",
    opacity: active ? 1 : 0.55,
  };
}

function tierOptions(minTier) {
  const idx = VALID_TIERS.indexOf(minTier);
  const startIdx = idx >= 0 ? idx : 0;
  return VALID_TIERS.slice(startIdx).map((sku) => ({
    sku,
    label: TIER_LABELS[sku],
  }));
}

// When both games are enabled they share one tier picker, so the floor it
// offers from must satisfy whichever game the viewer ends up clicking —
// the higher of the two minimums, not just "whichever game came first".
// Picking Plinko's floor when Slots' is higher would let a viewer select a
// tier that reads as valid, then get an unexpected server-side rejection
// the moment they click "Spin" instead of "Drop".
function sharedMinTier(hasPlinko, hasSlots, config) {
  const candidates = [];
  if (hasPlinko && config?.plinko?.minTier)
    candidates.push(config.plinko.minTier);
  if (hasSlots && config?.slots?.minTier) candidates.push(config.slots.minTier);
  return candidates.reduce((highest, t) => {
    if (!highest) return t;
    return VALID_TIERS.indexOf(t) > VALID_TIERS.indexOf(highest) ? t : highest;
  }, null);
}

export function GamesControls({
  auth,
  features,
  bitsEnabled,
  pendingType,
  pendingGamesTx,
  onGamesTxHandled,
  onStartTransaction,
}) {
  const [config, setConfig] = useState(null); // { plinko: {columns, minTier}, slots: {minTier} }
  const [selectedTier, setSelectedTier] = useState("");
  const [dropColumn, setDropColumn] = useState(0);
  const [gameChoice, setGameChoice] = useState("plinko"); // which game the icon toggle has selected, when both are available
  const [queue, setQueue] = useState({
    plinko: { waitingCount: 0, advanceSeq: 0 },
    slots: { waitingCount: 0, advanceSeq: 0 },
  });
  const [pendingPlay, setPendingPlay] = useState(null); // { type, position, advanceSeqAtJoin, remaining } | null
  const [error, setError] = useState(null);

  const hasPlinko = Boolean(features?.plinko);
  const hasSlots = Boolean(features?.slots);

  useEffect(() => {
    if (!auth) return;
    fetch(`${EBS_BASE}/api/games/config?channelId=${auth.channelId}`, {
      headers: { Authorization: `Bearer ${auth.token}` },
    })
      .then((r) => r.json())
      .then((data) => {
        setConfig(data);
        const minTier = sharedMinTier(hasPlinko, hasSlots, data);
        if (minTier) setSelectedTier(minTier);
      })
      .catch(() => {});
  }, [auth, hasPlinko, hasSlots]);

  useEffect(() => {
    if (!auth) return;
    const es = new EventSource(
      `${EBS_BASE}/api/games/queue-stream?channelId=${auth.channelId}`,
    );
    es.addEventListener("games_queue", (e) => {
      try {
        setQueue(JSON.parse(e.data));
      } catch {}
    });
    return () => es.close();
  }, [auth]);

  // Compute the live "how many plays until mine" from the last known
  // position/advanceSeqAtJoin and the current advanceSeq for that game.
  useEffect(() => {
    if (!pendingPlay) return;
    const snap = pendingPlay.type === "plinko" ? queue.plinko : queue.slots;
    const remaining = Math.max(
      0,
      pendingPlay.position - (snap.advanceSeq - pendingPlay.advanceSeqAtJoin),
    );
    if (remaining !== pendingPlay.remaining) {
      setPendingPlay({ ...pendingPlay, remaining });
    }
  }, [queue, pendingPlay]);

  // Once resolved ("You're up!"), fade the banner on its own after a few
  // seconds — matches every other transient status banner in this codebase
  // (e.g. ComponentApp.jsx's lastPlayed), rather than leaving it on screen
  // until the viewer plays again.
  useEffect(() => {
    if (!pendingPlay || pendingPlay.remaining > 0) return;
    const t = setTimeout(() => setPendingPlay(null), 4000);
    return () => clearTimeout(t);
  }, [pendingPlay]);

  // React to the host telling us a Bits transaction for a game just completed.
  useEffect(() => {
    if (!pendingGamesTx || !auth) return;
    const { type, receipt, dropColumn: col } = pendingGamesTx;
    const url =
      type === "plinko"
        ? `${EBS_BASE}/api/plinko/redeem`
        : `${EBS_BASE}/api/slots/redeem`;
    // No channelId in the body — the server derives the acting channel from
    // the viewer's own authenticated JWT (claims.channel_id), never from a
    // client-supplied value (a cross-channel IDOR was found and fixed here
    // post-Task-7; see POST /api/plinko/redeem's comment in server.js).
    const body = type === "plinko" ? { receipt, dropColumn: col } : { receipt };
    fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${auth.token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    })
      .then((r) => r.json())
      .then((data) => {
        if (!data.accepted) {
          setError(
            data.reason === "full"
              ? "Queue is full, try again shortly"
              : "Could not start — try again",
          );
          return;
        }
        setError(null);
        if (!data.duplicate) {
          setPendingPlay({
            type,
            position: data.position,
            advanceSeqAtJoin: data.advanceSeqAtJoin,
            remaining: data.position,
          });
        }
      })
      .catch(() => setError("Could not start — try again"))
      .finally(() => onGamesTxHandled?.());
  }, [pendingGamesTx, auth, onGamesTxHandled]);

  const handlePlay = useCallback(
    (type) => {
      if (!selectedTier) return;
      const extra = type === "plinko" ? { dropColumn } : undefined;
      onStartTransaction(type, selectedTier, extra);
    },
    [selectedTier, dropColumn, onStartTransaction],
  );

  if (!hasPlinko && !hasSlots) return null;
  if (!config) return null;

  const minTier = sharedMinTier(hasPlinko, hasSlots, config);
  const options = tierOptions(minTier);
  const columns = config.plinko?.columns || 10;

  // Which game is actually showing: the icon toggle's choice when both are
  // available, otherwise whichever single game is — same "one derived value
  // instead of scattered pairwise checks" pattern App.jsx/ComponentApp.jsx
  // use for effectiveTab, and for the same reason: it's the only value that
  // stays correct once there's a third combination (here, "just one game")
  // to account for.
  const effectiveGame = hasPlinko && hasSlots ? gameChoice : hasPlinko ? "plinko" : "slots";

  return (
    <div>
      {error && (
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
          {error}
        </div>
      )}

      {pendingPlay && (
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
          {pendingPlay.remaining > 0
            ? `Queued — ~${pendingPlay.remaining} ahead of you`
            : "You're up!"}
        </div>
      )}

      {!bitsEnabled && (
        <div style={{ fontSize: 12, opacity: 0.5, marginBottom: 6 }}>
          Bits are not available on this channel.
        </div>
      )}

      {hasPlinko && hasSlots && (
        <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
          <button onClick={() => setGameChoice("plinko")} style={gameToggleStyle(effectiveGame === "plinko")}>
            <div style={{ fontSize: 20 }}>🎯</div>
            <div style={{ fontSize: 10, fontWeight: 700, marginTop: 4, letterSpacing: 0.3 }}>
              PLINKO
            </div>
          </button>
          <button onClick={() => setGameChoice("slots")} style={gameToggleStyle(effectiveGame === "slots")}>
            <div style={{ fontSize: 20 }}>🎰</div>
            <div style={{ fontSize: 10, fontWeight: 700, marginTop: 4, letterSpacing: 0.3 }}>
              SLOTS
            </div>
          </button>
        </div>
      )}

      {bitsEnabled && options.length > 0 && (
        <select
          value={selectedTier}
          onChange={(e) => setSelectedTier(e.target.value)}
          style={selectStyle}
        >
          {options.map((opt) => (
            <option key={opt.sku} value={opt.sku}>
              {opt.label}
            </option>
          ))}
        </select>
      )}

      {effectiveGame === "plinko" ? (
        <Plinko
          columns={columns}
          dropColumn={dropColumn}
          setDropColumn={setDropColumn}
          handlePlay={handlePlay}
          bitsEnabled={bitsEnabled}
          pendingType={pendingType}
          selectedTier={selectedTier}
        />
      ) : (
        <Slots
          handlePlay={handlePlay}
          bitsEnabled={bitsEnabled}
          pendingType={pendingType}
          selectedTier={selectedTier}
        />
      )}
    </div>
  );
}

function Plinko({
  columns,
  dropColumn,
  setDropColumn,
  handlePlay,
  bitsEnabled,
  pendingType,
  selectedTier,
}) {
  const disabled = !bitsEnabled || pendingType === "plinko";
  return (
    <div>
      <div style={{ fontSize: 11, opacity: 0.6, marginBottom: 5 }}>
        Drop into column
      </div>
      <select
        value={dropColumn}
        onChange={(e) => setDropColumn(Number(e.target.value))}
        style={selectStyle}
      >
        {Array.from({ length: columns }, (_, i) => (
          <option key={i} value={i}>
            {`Column ${i + 1}`}
          </option>
        ))}
      </select>
      <button onClick={() => handlePlay("plinko")} disabled={disabled} style={playButtonStyle(disabled)}>
        {`Drop Token — ${TIER_LABELS[selectedTier] || selectedTier}`}
      </button>
    </div>
  );
}

function Slots({ handlePlay, bitsEnabled, pendingType, selectedTier }) {
  const disabled = !bitsEnabled || pendingType === "slots";
  return (
    <div>
      <button onClick={() => handlePlay("slots")} disabled={disabled} style={playButtonStyle(disabled)}>
        {`Spin — ${TIER_LABELS[selectedTier] || selectedTier}`}
      </button>
    </div>
  );
}
