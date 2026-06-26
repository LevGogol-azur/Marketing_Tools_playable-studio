// Server resolution + API helpers for the Playable Studio backend (reached via ngrok).

import type { Page, RunAgentOptions, UploadInput } from "@/types";

const SERVER_KEY = "ps_server_url";
// ngrok-free shows a browser-warning interstitial for HTML loads; this header skips it.
const NGROK_HEADERS = { "ngrok-skip-browser-warning": "1" };

const trim = (u: string | null): string => (u || "").trim().replace(/\/+$/, "");

export function getOverride(): string {
  return trim(localStorage.getItem(SERVER_KEY));
}
export function setOverride(url: string): void {
  localStorage.setItem(SERVER_KEY, trim(url));
}

// Resolve the server URL. Priority:
// 1. ?server=URL query param (dev/testing)
// 2. repo-managed server-url.json (central — automatic for everyone)
// 3. local override saved via the ⚙ Сервер dialog
export async function resolveServer(): Promise<string> {
  const q = trim(new URLSearchParams(location.search).get("server"));
  if (q) {
    setOverride(q);
    return q;
  }
  try {
    const res = await fetch("server-url.json?t=" + Date.now(), { cache: "no-store" });
    if (res.ok) {
      const data = (await res.json()) as { url?: string } | null;
      if (data && data.url) return trim(data.url);
    }
  } catch {
    /* fall through to local override */
  }
  return getOverride();
}

export async function listPages(server: string): Promise<Page[]> {
  const res = await fetch(server + "/api/pages", { cache: "no-store", headers: NGROK_HEADERS });
  if (!res.ok) throw new Error("HTTP " + res.status);
  const data = (await res.json()) as { pages?: Page[] } | null;
  return (data && data.pages) || [];
}

export async function uploadPage(
  server: string,
  { filename, title, folder, contentBase64 }: UploadInput,
): Promise<Page> {
  const res = await fetch(server + "/api/pages", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...NGROK_HEADERS },
    body: JSON.stringify({ filename, title, folder, contentBase64 }),
  });
  if (!res.ok) {
    const d = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(d.error || "HTTP " + res.status);
  }
  const data = (await res.json()) as { page: Page };
  return data.page;
}

export async function renamePage(server: string, file: string, title: string): Promise<Page> {
  const res = await fetch(server + "/api/pages/" + encodeURIComponent(file), {
    method: "PATCH",
    headers: { "Content-Type": "application/json", ...NGROK_HEADERS },
    body: JSON.stringify({ title }),
  });
  if (!res.ok) {
    const d = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(d.error || "HTTP " + res.status);
  }
  const data = (await res.json()) as { page: Page };
  return data.page;
}

export async function movePage(server: string, file: string, folder: string): Promise<Page> {
  const res = await fetch(server + "/api/pages/" + encodeURIComponent(file), {
    method: "PATCH",
    headers: { "Content-Type": "application/json", ...NGROK_HEADERS },
    body: JSON.stringify({ folder }),
  });
  if (!res.ok) {
    const d = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(d.error || "HTTP " + res.status);
  }
  const data = (await res.json()) as { page: Page };
  return data.page;
}

// Parse one SSE chunk (the text between two blank lines) into { type, data }.
// `type` is the `event:` field (defaults to "message"); `data` joins all
// `data:` lines. Returns null for an empty/blank chunk so callers can skip it.
function parseSseChunk(chunk: string): { type: string; data: string } | null {
  if (!chunk.trim()) return null;
  let type = "message";
  const dataLines: string[] = [];
  for (const line of chunk.split("\n")) {
    if (line.startsWith("event:")) type = line.slice(6).trim();
    else if (line.startsWith("data:")) dataLines.push(line.slice(5).replace(/^ /, ""));
  }
  return { type, data: dataLines.join("\n") };
}

// Run the sandboxed agent on a builder. Streams the agent's text via onTextCallback as
// it arrives; resolves with the new -ai page entry ({ file, title, folder,
// uploaded }) once saved server-side — page.file is what you open in the viewer.
export async function runAgent(
  server: string,
  file: string,
  prompt: string,
  { onTextCallback, signal }: RunAgentOptions = {},
): Promise<Page | null> {
  const res = await fetch(server + "/api/pages/" + encodeURIComponent(file) + "/agent", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...NGROK_HEADERS },
    body: JSON.stringify({ prompt }),
    signal,
  });
  if (!res.ok) {
    const d = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(d.error || "HTTP " + res.status);
  }
  if (!res.body) throw new Error("No response body");

  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = "";
  let page: Page | null = null;
  let errMsg: string | null = null;

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });

    const chunks = buf.split("\n\n");
    buf = chunks.pop() ?? ""; // keep the partial tail
    for (const chunk of chunks) {
      const parsed = parseSseChunk(chunk);
      if (!parsed) continue;
      const { type, data } = parsed;
      if (type === "done") page = JSON.parse(data) as Page;
      else if (type === "error") {
        try {
          errMsg = JSON.parse(data) as string;
        } catch {
          errMsg = data || "error";
        }
      } else if (onTextCallback) onTextCallback(data);
    }
  }

  if (errMsg) throw new Error(errMsg);
  return page; // { file, title, folder, uploaded } | null
}

export async function deletePage(server: string, file: string): Promise<void> {
  const res = await fetch(server + "/api/pages/" + encodeURIComponent(file), {
    method: "DELETE",
    headers: NGROK_HEADERS,
  });
  if (!res.ok) throw new Error("HTTP " + res.status);
}

// Session cache of fetched playables. Filenames are unique and never overwritten,
// so a blob URL stays valid for the whole session — re-opening is instant.
const blobCache = new Map<string, string>(); // file -> blobUrl
const inflight = new Map<string, Promise<string>>(); // file -> Promise<blobUrl>

// Fetch a page with the skip-warning header and return a blob URL (iframe nav can't set headers).
export async function fetchPageBlobUrl(server: string, file: string): Promise<string> {
  const cached = blobCache.get(file);
  if (cached) return cached;
  const pending = inflight.get(file);
  if (pending) return pending;

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
export function prefetchPage(server: string, file: string): void {
  if (!server || blobCache.has(file) || inflight.has(file)) return;
  fetchPageBlobUrl(server, file).catch(() => {});
}

export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const r = reader.result;
      resolve(typeof r === "string" ? r.slice(r.indexOf(",") + 1) : "");
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
