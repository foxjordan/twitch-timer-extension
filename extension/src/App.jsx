import { useEffect, useRef, useState } from 'react';
import ReactDOM from 'react-dom/client';

function App() {
  const [remaining, setRemaining] = useState(0);
  const [hype, setHype] = useState(false);
  const tickRef = useRef();

  useEffect(() => {
    // Twitch extension lifecycle
    window.Twitch?.ext?.onAuthorized(() => {
      // no-op for reads; broadcasts are public
    });

    window.Twitch?.ext?.listen?.('broadcast', (_t, _c, message) => {
      try {
        const data = JSON.parse(message);
        if (data.type === 'timer_reset' || data.type === 'timer_tick') {
          setRemaining(data.payload.remaining ?? 0);
        } else if (data.type === 'timer_add') {
          setRemaining(data.payload.newRemaining ?? 0);
          setHype(Boolean(data.payload.hype));
        }
      } catch {}
    });

    // Local decrement for smoothness between server ticks
    const loop = () => {
      setRemaining(r => (r > 0 ? r - 1 : 0));
      tickRef.current = setTimeout(loop, 1000);
    };
    loop();
    return () => clearTimeout(tickRef.current);
  }, []);

  const mm = String(Math.floor(remaining / 60)).padStart(2, '0');
  const ss = String(remaining % 60).padStart(2, '0');

  return (
    <div style={{ padding: 12 }}>
      <div style={{
        padding: 16,
        borderRadius: 16,
        background: '#1f1f23',
        boxShadow: '0 0 0 1px #303038 inset'
      }}>
        <div style={{ fontSize: 18, opacity: 0.85 }}>Stream Countdown</div>
        <div style={{ fontFamily: 'monospace', fontSize: 64, lineHeight: 1, marginTop: 8 }}>
          {mm}:{ss}
        </div>
        {hype && (
          <div style={{
            marginTop: 8,
            padding: '6px 10px',
            borderRadius: 999,
            display: 'inline-block',
            background: '#9146FF22',
            boxShadow: '0 0 0 1px #9146FF inset',
            fontSize: 12
          }}>
            🔥 Hype Train active — time gains doubled!
          </div>
        )}
      </div>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
export default App;
