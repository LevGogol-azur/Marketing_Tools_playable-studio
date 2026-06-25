// Reads the public URL from the locally running ngrok agent (http://localhost:4040)
// and writes it to frontend/public/server-url.json so the built SPA picks it up.
// Run while `ngrok http 3000` is active:  npm run publish-url
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const here = path.dirname(fileURLToPath(import.meta.url));
// Anchor on the server package root (strip a trailing `dist` if run compiled).
const ROOT = path.basename(here) === "dist" ? path.join(here, "..") : here;
const OUT = path.join(ROOT, "..", "frontend", "public", "server-url.json");
const NGROK_API = process.env.NGROK_API || "http://localhost:4040/api/tunnels";

interface Tunnel {
  public_url?: string;
}

try {
  const res = await fetch(NGROK_API);
  if (!res.ok) throw new Error("ngrok API HTTP " + res.status);
  const data = (await res.json()) as { tunnels?: Tunnel[] };
  const tunnels = data.tunnels || [];
  const https = tunnels.find((t) => t.public_url?.startsWith("https://"));
  const url = https?.public_url || tunnels[0]?.public_url;
  if (!url) throw new Error("no active ngrok tunnel found");

  fs.writeFileSync(OUT, JSON.stringify({ url }, null, 2) + "\n");
  console.log("Wrote " + OUT);
  console.log("URL:  " + url);
  console.log("\nNow commit & push so everyone gets it:");
  console.log('  git add frontend/public/server-url.json && git commit -m "Update server URL" && git push');
} catch (e: any) {
  console.error("Failed: " + e.message);
  console.error("Is ngrok running?  ngrok http 3000");
  process.exit(1);
}
