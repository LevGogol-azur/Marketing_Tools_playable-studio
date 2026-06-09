// Server resolution + API helpers for the Playable Studio backend (reached via ngrok).

const SERVER_KEY = "ps_server_url";
// ngrok-free shows a browser-warning interstitial for HTML loads; this header skips it.
const NGROK_HEADERS = { "ngrok-skip-browser-warning": "1" };

const trim = (u) => (u || "").trim().replace(/\/+$/, "");

export function getOverride() {
  return trim(localStorage.getItem(SERVER_KEY));
}
export function setOverride(url) {
  localStorage.setItem(SERVER_KEY, trim(url));
}

// Resolve the server URL. Priority:
//   1. ?server=URL query param (dev/testing)
//   2. repo-managed server-url.json (central — automatic for everyone)
//   3. local override saved via the ⚙ Сервер dialog
export async function resolveServer() {
  const q = trim(new URLSearchParams(location.search).get("server"));
  if (q) {
    setOverride(q);
    return q;
  }
  try {
    const res = await fetch("server-url.json?t=" + Date.now(), { cache: "no-store" });
    if (res.ok) {
      const data = await res.json();
      if (data && data.url) return trim(data.url);
    }
  } catch (_) {
    /* fall through to local override */
  }
  return getOverride();
}

export async function listPages(server) {
  const res = await fetch(server + "/api/pages", { cache: "no-store", headers: NGROK_HEADERS });
  if (!res.ok) throw new Error("HTTP " + res.status);
  const data = await res.json();
  return (data && data.pages) || [];
}

export async function uploadPage(server, { filename, title, folder, contentBase64 }) {
  const res = await fetch(server + "/api/pages", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...NGROK_HEADERS },
    body: JSON.stringify({ filename, title, folder, contentBase64 }),
  });
  if (!res.ok) {
    const d = await res.json().catch(() => ({}));
    throw new Error(d.error || "HTTP " + res.status);
  }
  const data = await res.json();
  return data.page;
}

export async function renamePage(server, file, title) {
  const res = await fetch(server + "/api/pages/" + encodeURIComponent(file), {
    method: "PATCH",
    headers: { "Content-Type": "application/json", ...NGROK_HEADERS },
    body: JSON.stringify({ title }),
  });
  if (!res.ok) {
    const d = await res.json().catch(() => ({}));
    throw new Error(d.error || "HTTP " + res.status);
  }
  const data = await res.json();
  return data.page;
}

export async function movePage(server, file, folder) {
  const res = await fetch(server + "/api/pages/" + encodeURIComponent(file), {
    method: "PATCH",
    headers: { "Content-Type": "application/json", ...NGROK_HEADERS },
    body: JSON.stringify({ folder }),
  });
  if (!res.ok) {
    const d = await res.json().catch(() => ({}));
    throw new Error(d.error || "HTTP " + res.status);
  }
  const data = await res.json();
  return data.page;
}

export async function deletePage(server, file) {
  const res = await fetch(server + "/api/pages/" + encodeURIComponent(file), {
    method: "DELETE",
    headers: NGROK_HEADERS,
  });
  if (!res.ok) throw new Error("HTTP " + res.status);
}

// Session cache of fetched playables. Filenames are unique and never overwritten,
// so a blob URL stays valid for the whole session — re-opening is instant.
const blobCache = new Map(); // file -> blobUrl
const inflight = new Map(); // file -> Promise<blobUrl>

// Fetch a page with the skip-warning header and return a blob URL (iframe nav can't set headers).
export async function fetchPageBlobUrl(server, file) {
  if (blobCache.has(file)) return blobCache.get(file);
  if (inflight.has(file)) return inflight.get(file);

  const p = (async () => {
    const res = await fetch(server + "/pages/" + encodeURIComponent(file), {
      headers: NGROK_HEADERS,
    });
    if (!res.ok) throw new Error("HTTP " + res.status);
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    blobCache.set(file, url);
    return url;
  })();

  inflight.set(file, p);
  try {
    return await p;
  } finally {
    inflight.delete(file);
  }
}

// Warm the cache ahead of a click (e.g. on hover). Fire-and-forget.
export function prefetchPage(server, file) {
  if (!server || blobCache.has(file) || inflight.has(file)) return;
  fetchPageBlobUrl(server, file).catch(() => {});
}

export function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result.slice(reader.result.indexOf(",") + 1));
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
