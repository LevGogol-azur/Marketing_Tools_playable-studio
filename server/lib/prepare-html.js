// Prepare a builder's HTML for sending to the LLM.
// We pass the WHOLE HTML (so the model can analyze everything), but replace the
// base64 payloads of inlined assets — and bare packed base64 bundles — with short
// placeholders. Those bytes are useless for analyzing tunable parameters and would
// blow past the context window / cost for 8–10 MB files.

function humanSize(bytes) {
  if (bytes >= 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + "MB";
  if (bytes >= 1024) return Math.round(bytes / 1024) + "KB";
  return bytes + "B";
}

// data:<mime>;base64,<payload>  — inlined images / audio / fonts / video
const DATA_URI_RE = /data:([a-z]+\/[a-z0-9.+-]+);base64,([A-Za-z0-9+/]+={0,2})/gi;
// Bare long base64 strings (packed bundles via pako/jszip), not inside a data: URI.
const PACKED_RE = /"([A-Za-z0-9+/]{1500,}={0,2})"/g;

export function prepareHtmlForLLM(html) {
  let assetCount = 0;
  let strippedBytes = 0;

  let text = html.replace(DATA_URI_RE, (_m, mime, payload) => {
    const bytes = Math.floor(payload.length * 0.75);
    strippedBytes += payload.length;
    const placeholder = `data:${mime};base64,<asset:${assetCount} ${mime} ~${humanSize(bytes)}>`;
    assetCount++;
    return placeholder;
  });

  text = text.replace(PACKED_RE, (m, payload) => {
    // Skip our own freshly-inserted placeholders.
    if (payload.startsWith("<asset:")) return m;
    const bytes = Math.floor(payload.length * 0.75);
    strippedBytes += payload.length;
    const out = `"<packed-base64:${assetCount} ~${humanSize(bytes)}>"`;
    assetCount++;
    return out;
  });

  return { text, assetCount, strippedBytes };
}

// Fallback for files too large to send whole: extract the verbatim config region(s)
// so find/replace anchors still match the original file. Returns a string or null.
export function extractConfigRegion(html) {
  const parts = [];
  const patterns = [
    /<!--\s*@LEVEL_START\s*-->[\s\S]*?<!--\s*@LEVEL_END\s*-->/,
    /\/\*\s*@LEVEL_START\s*\*\/[\s\S]*?\/\*\s*@LEVEL_END\s*\*\//,
    /(?:const|let|var)\s+(?:CONFIG|config|DEFAULT_LEVEL|GAME_CONFIG|gameConfig)\s*=\s*\{[\s\S]*?\n\s*\};/,
    /(?:const|let|var)\s+CONFIG_FIELDS\s*=\s*\[[\s\S]*?\n\s*\];/,
  ];
  for (const re of patterns) {
    const m = html.match(re);
    if (m && m[0] && !parts.includes(m[0])) parts.push(m[0]);
  }
  if (!parts.length) return null;
  return parts.join("\n\n/* ───────── */\n\n");
}
