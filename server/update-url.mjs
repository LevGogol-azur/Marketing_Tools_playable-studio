// Reads the public URL from the locally running ngrok agent (http://localhost:4040)
// and writes it to ../server-url.json so the SPA on GitHub Pages picks it up.
// Run while `ngrok http 3000` is active:  npm run publish-url
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(__dirname, "..", "server-url.json");
const NGROK_API = process.env.NGROK_API || "http://localhost:4040/api/tunnels";

try {
  const res = await fetch(NGROK_API);
  if (!res.ok) throw new Error("ngrok API HTTP " + res.status);
  const data = await res.json();
  const https = (data.tunnels || []).find((t) => t.public_url?.startsWith("https://"));
  const url = https?.public_url || (data.tunnels || [])[0]?.public_url;
  if (!url) throw new Error("no active ngrok tunnel found");

  fs.writeFileSync(OUT, JSON.stringify({ url }, null, 2) + "\n");
  console.log("Wrote " + OUT);
  console.log("URL:  " + url);
  console.log("\nNow commit & push so everyone gets it:");
  console.log('  git add server-url.json && git commit -m "Update server URL" && git push');
} catch (e) {
  console.error("Failed: " + e.message);
  console.error("Is ngrok running?  ngrok http 3000");
  process.exit(1);
}
