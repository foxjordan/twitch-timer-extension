import { useEffect, useState, useCallback } from "react";
import { VALID_TIERS, TIER_LABELS } from "./tiers.js";

const EBS_BASE = import.meta.env.VITE_EBS_BASE || "https://livestreamerhub.com";

function tierOptions(minTier) {
  const idx = VALID_TIERS.indexOf(minTier);
  const startIdx = idx >= 0 ? idx : 0;
  return VALID_TIERS.slice(startIdx).map((sku) => ({ sku, label: TIER_LABELS[sku] }));
}

// When both games are enabled they share one tier picker, so the floor it
// offers from must satisfy whichever game the viewer ends up clicking —
// the higher of the two minimums, not just "whichever game came first".
// Picking Plinko's floor when Slots' is higher would let a viewer select a
// tier that reads as valid, then get an unexpected server-side rejection
// the moment they click "Spin" instead of "Drop".
function sharedMinTier(hasPlinko, hasSlots, config) {
  const candidates = [];
  if (hasPlinko && config?.plinko?.minTier) candidates.push(config.plinko.minTier);
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
  const [queue, setQueue] = useState({ plinko: { waitingCount: 0, advanceSeq: 0 }, slots: { waitingCount: 0, advanceSeq: 0 } });
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
    const es = new EventSource(`${EBS_BASE}/api/games/queue-stream?channelId=${auth.channelId}`);
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
    const remaining = Math.max(0, pendingPlay.position - (snap.advanceSeq - pendingPlay.advanceSeqAtJoin));
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
    const url = type === "plinko" ? `${EBS_BASE}/api/plinko/redeem` : `${EBS_BASE}/api/slots/redeem`;
    // No channelId in the body — the server derives the acting channel from
    // the viewer's own authenticated JWT (claims.channel_id), never from a
    // client-supplied value (a cross-channel IDOR was found and fixed here
    // post-Task-7; see POST /api/plinko/redeem's comment in server.js).
    const body = type === "plinko" ? { receipt, dropColumn: col } : { receipt };
    fetch(url, {
      method: "POST",
      headers: { Authorization: `Bearer ${auth.token}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
      .then((r) => r.json())
      .then((data) => {
        if (!data.accepted) {
          setError(data.reason === "full" ? "Queue is full, try again shortly" : "Could not start — try again");
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

  return (
    <div>
      {error && (
        <div style={{ padding: "6px 10px", borderRadius: 8, background: "#c0392b22", border: "1px solid #c0392b44", fontSize: 12, marginBottom: 8, color: "#e74c3c" }}>
          {error}
        </div>
      )}

      {pendingPlay && (
        <div style={{ padding: "6px 10px", borderRadius: 8, background: "#9146FF22", border: "1px solid #9146FF44", fontSize: 12, marginBottom: 8, textAlign: "center" }}>
          {pendingPlay.remaining > 0 ? `Queued — ~${pendingPlay.remaining} ahead of you` : "You're up!"}
        </div>
      )}

      {!bitsEnabled && (
        <div style={{ fontSize: 12, opacity: 0.5, marginBottom: 6 }}>
          Bits are not available on this channel.
        </div>
      )}

      {bitsEnabled && options.length > 0 && (
        <div style={{ marginBottom: 8 }}>
          <select
            value={selectedTier}
            onChange={(e) => setSelectedTier(e.target.value)}
            style={{ width: "100%", padding: 6, borderRadius: 8 }}
          >
            {options.map((opt) => (
              <option key={opt.sku} value={opt.sku}>{opt.label}</option>
            ))}
          </select>
        </div>
      )}

      {hasPlinko && (
        <div style={{ marginBottom: 10 }}>
          <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginBottom: 8 }}>
            {Array.from({ length: columns }, (_, i) => (
              <button
                key={i}
                onClick={() => setDropColumn(i)}
                style={{
                  flex: "1 0 auto",
                  minWidth: 28,
                  padding: "6px 0",
                  borderRadius: 6,
                  border: "none",
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: "pointer",
                  background: dropColumn === i ? "#9146FF" : "#303038",
                  color: "#fff",
                }}
              >
                {i}
              </button>
            ))}
          </div>
          <button
            onClick={() => handlePlay("plinko")}
            disabled={!bitsEnabled || pendingType === "plinko"}
            style={{
              width: "100%",
              padding: "8px 0",
              borderRadius: 8,
              border: "none",
              fontSize: 13,
              fontWeight: 600,
              cursor: bitsEnabled ? "pointer" : "default",
              background: "#9146FF",
              color: "#fff",
              opacity: !bitsEnabled || pendingType === "plinko" ? 0.5 : 1,
            }}
          >
            {`Drop — ${TIER_LABELS[selectedTier] || selectedTier}`}
          </button>
        </div>
      )}

      {hasSlots && (
        <button
          onClick={() => handlePlay("slots")}
          disabled={!bitsEnabled || pendingType === "slots"}
          style={{
            width: "100%",
            padding: "8px 0",
            borderRadius: 8,
            border: "none",
            fontSize: 13,
            fontWeight: 600,
            cursor: bitsEnabled ? "pointer" : "default",
            background: "#9146FF",
            color: "#fff",
            opacity: !bitsEnabled || pendingType === "slots" ? 0.5 : 1,
          }}
        >
          {`Spin — ${TIER_LABELS[selectedTier] || selectedTier}`}
        </button>
      )}
    </div>
  );
}
