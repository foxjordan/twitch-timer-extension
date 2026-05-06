const linkStyle = {
  color: "#bf94ff",
  opacity: 0.55,
  fontSize: 11,
  textDecoration: "none",
  display: "flex",
  alignItems: "center",
  gap: 3,
  letterSpacing: "0.02em",
};

function ExternalIcon() {
  return (
    <svg width="9" height="9" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
      <path d="M5 2H2a1 1 0 0 0-1 1v7a1 1 0 0 0 1 1h7a1 1 0 0 0 1-1V7" />
      <path d="M8 1h3v3" />
      <path d="M12 1L6 7" />
    </svg>
  );
}

export function BrandedFooter({ style }) {
  return (
    <div style={{
      display: "flex",
      justifyContent: "space-evenly",
      alignItems: "center",
      padding: "8px 10px 6px",
      flexShrink: 0,
      ...style,
    }}>
      <a href="https://livestreamerhub.com" target="_blank" rel="noopener noreferrer" style={linkStyle}>
        LiveStreamer Hub <ExternalIcon />
      </a>
      <a href="https://livestreamerhub.com/privacy" target="_blank" rel="noopener noreferrer" style={linkStyle}>
        Privacy Policy <ExternalIcon />
      </a>
    </div>
  );
}
