import express, { type Request, type Response } from "express";
import cors from "cors";
import compression from "compression";
import fs from "fs";
import path from "path";
import { handleAgentStreaming, runAgentStream } from "./lib/claude.js";
import { PAGES_DIR, MANIFEST, PORT } from "./lib/constants.js";
import { readManifest, ManifestEntry, writeManifest } from "./lib/manifest.js";
import { slugify } from "./lib/utils.js";


// Ensure storage exists
fs.mkdirSync(PAGES_DIR, { recursive: true });
if (!fs.existsSync(MANIFEST)) {
	fs.writeFileSync(MANIFEST, JSON.stringify({ pages: [] }, null, 2) + "\n");
}

const app = express();
app.use(compression()); // gzip responses (playables are large, mostly text)
app.use(cors()); // allow the GitHub Pages origin (and any other) to call this server
app.use(express.json({ limit: "60mb" })); // playables can be large


// --- API: list pages ---
app.get("/api/pages", (_req: Request, res: Response) => {
	res.json(readManifest());
});

// --- API: upload a page ---
// Body: { filename, title, folder, contentBase64 }
app.post("/api/pages", (req: Request, res: Response) => {
	const { filename, title, folder, contentBase64 } = req.body || {};
	if (!title || !contentBase64) {
		return res.status(400).json({ error: "title and contentBase64 are required" });
	}
	if (filename && !/\.html?$/i.test(filename)) {
		return res.status(400).json({ error: "file must be .html" });
	}

	let buffer: Buffer;
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
	const entry: ManifestEntry = {
		file,
		title: String(title),
		folder: folder ? String(folder).trim() : "",
		uploaded: new Date().toISOString(),
	};
	manifest.pages.push(entry);
	writeManifest(manifest);

	res.json({ ok: true, page: entry });
});

// --- API: update a page (e.g. move to a folder) ---
// Body: { folder?, title? }
app.patch("/api/pages/:file", (req: Request, res: Response) => {
	const file = path.basename(req.params.file);
	const manifest = readManifest();
	const entry = manifest.pages.find((p) => p.file === file);
	if (!entry) return res.status(404).json({ error: "not found" });

	const { folder, title } = req.body || {};
	if (folder !== undefined) entry.folder = folder ? String(folder).trim() : "";
	if (title !== undefined && title) entry.title = String(title);
	writeManifest(manifest);

	res.json({ ok: true, page: entry });
});

// --- API: delete a page ---
app.delete("/api/pages/:file", (req: Request, res: Response) => {
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

// --- AI agent: run the sandboxed Claude agent on a builder, stream text via SSE,
// then save the result as a NEW -ai copy (original untouched). ---
// Body: { prompt }. Response is text/event-stream:
//   `data:` lines        -> the agent's text, as it is produced
//   `event: done` + data -> JSON of the new ManifestEntry once saved
//   `event: error` + data-> error message string
app.post("/api/pages/:file/agent", async (req: Request, res: Response) => {
	const file = path.basename(req.params.file);

	const prompt = typeof req.body?.prompt === "string" ? req.body.prompt.trim() : "";
	if (!prompt) return res.status(400).json({ error: "prompt required" });

	const initStreamCallback = () => {
		res.writeHead(200, {
			"Content-Type": "text/event-stream",
			"Cache-Control": "no-cache, no-transform",
			Connection: "keep-alive",
			"X-Accel-Buffering": "no",
		});
	}

	const sseCallback = (text: string) => {
		if (res.writableEnded) return;
		res.write(text.split("\n").map((l) => "data: " + l).join("\n") + "\n\n");
		(res as any).flush?.(); // compression() buffers the stream otherwise
	};

	const abortController = new AbortController();
	res.on("close", () => abortController.abort());

	const streamingEndCallback = (data?: string, event: string = "done") => {
		if (!res.writableEnded) {
			if (data) res.write(`event: ${event}\ndata: ` + data + "\n\n");
			res.end();
		}
	}

	const error = await handleAgentStreaming(
		file,
		prompt,
		initStreamCallback,
		sseCallback,
		abortController.signal,
		streamingEndCallback
	);
	if (error) return res.status(error.status).json({ error: error.message });
});

// --- Serve the stored playable pages ---
// Filenames are unique and never overwritten, so contents are effectively
// immutable per name — let the browser cache them.
app.use(
	"/pages",
	express.static(PAGES_DIR, { extensions: ["html"], dotfiles: "ignore", maxAge: "7d" })
);

app.get("/", (_req: Request, res: Response) => {
	res.type("text/plain").send("Playable Studio server is running. API: /api/pages");
});

app.listen(PORT, () => {
	console.log(`Playable Studio server on http://localhost:${PORT}`);
	console.log(`Storage: ${PAGES_DIR}`);
	console.log(`Expose publicly with:  ngrok http ${PORT}`);
});
