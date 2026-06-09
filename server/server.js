import express from "express";
import cors from "cors";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PAGES_DIR = path.join(__dirname, "pages");
const MANIFEST = path.join(PAGES_DIR, "manifest.json");
const PORT = process.env.PORT || 3000;

// Ensure storage exists
fs.mkdirSync(PAGES_DIR, { recursive: true });
if (!fs.existsSync(MANIFEST)) {
  fs.writeFileSync(MANIFEST, JSON.stringify({ pages: [] }, null, 2) + "\n");
}

const app = express();
app.use(cors()); // allow the GitHub Pages origin (and any other) to call this server
app.use(express.json({ limit: "60mb" })); // playables can be large

function readManifest() {
  try {
    const m = JSON.parse(fs.readFileSync(MANIFEST, "utf8"));
    if (!Array.isArray(m.pages)) m.pages = [];
    return m;
  } catch {
    return { pages: [] };
  }
}

function writeManifest(m) {
  fs.writeFileSync(MANIFEST, JSON.stringify(m, null, 2) + "\n");
}

function slugify(name) {
  return (
    (name || "page")
      .toLowerCase()
      .replace(/\.html?$/i, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 80) || "page"
  );
}

// --- API: list pages ---
app.get("/api/pages", (_req, res) => {
  res.json(readManifest());
});

// --- API: upload a page ---
// Body: { filename, title, contentBase64 }
app.post("/api/pages", (req, res) => {
  const { filename, title, contentBase64 } = req.body || {};
  if (!title || !contentBase64) {
    return res.status(400).json({ error: "title and contentBase64 are required" });
  }
  if (filename && !/\.html?$/i.test(filename)) {
    return res.status(400).json({ error: "file must be .html" });
  }

  let buffer;
  try {
    buffer = Buffer.from(contentBase64, "base64");
  } catch {
    return res.status(400).json({ error: "invalid base64 content" });
  }

  // Unique filename within the pages dir
  const base = slugify(filename || title);
  let file = base + ".html";
  let n = 2;
  while (fs.existsSync(path.join(PAGES_DIR, file))) {
    file = base + "-" + n++ + ".html";
  }

  fs.writeFileSync(path.join(PAGES_DIR, file), buffer);

  const manifest = readManifest();
  const entry = {
    file,
    title: String(title),
    uploaded: new Date().toISOString(),
  };
  manifest.pages.push(entry);
  writeManifest(manifest);

  res.json({ ok: true, page: entry });
});

// --- API: delete a page ---
app.delete("/api/pages/:file", (req, res) => {
  const file = path.basename(req.params.file); // guard against path traversal
  const manifest = readManifest();
  const idx = manifest.pages.findIndex((p) => p.file === file);
  if (idx === -1) return res.status(404).json({ error: "not found" });

  manifest.pages.splice(idx, 1);
  writeManifest(manifest);

  const fp = path.join(PAGES_DIR, file);
  if (fs.existsSync(fp)) fs.unlinkSync(fp);

  res.json({ ok: true });
});

// --- Serve the stored playable pages ---
app.use(
  "/pages",
  express.static(PAGES_DIR, { extensions: ["html"], dotfiles: "ignore" })
);

app.get("/", (_req, res) => {
  res.type("text/plain").send("Playable Studio server is running. API: /api/pages");
});

app.listen(PORT, () => {
  console.log(`Playable Studio server on http://localhost:${PORT}`);
  console.log(`Storage: ${PAGES_DIR}`);
  console.log(`Expose publicly with:  ngrok http ${PORT}`);
});
