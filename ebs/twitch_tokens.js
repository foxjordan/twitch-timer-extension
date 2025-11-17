const accessTokens = new Map();

export function storeUserAccessToken(uid, token, expiresIn) {
  if (!uid || !token) return;
  const ttl = Number(expiresIn) || 0;
  const expiresAt = ttl > 0 ? Date.now() + ttl * 1000 : null;
  accessTokens.set(String(uid), { token, expiresAt });
}

export function getUserAccessToken(uid) {
  const entry = accessTokens.get(String(uid));
  if (!entry) return null;
  if (entry.expiresAt && Date.now() >= entry.expiresAt - 60000) {
    accessTokens.delete(String(uid));
    return null;
  }
  return entry.token;
}
