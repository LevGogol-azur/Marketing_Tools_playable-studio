// Host side: run a one-shot Claude agent against a SINGLE builder HTML inside a
// throwaway Docker container, streaming its text out as it works.
//
// Flow: copy the target file into a fresh temp dir -> `docker run` with only
// that dir mounted at /work -> the agent edits the file in place -> read the
// edited file back and return it. The container is the sandbox: the agent only
// ever sees that one file. The ORIGINAL is never modified here — the caller
// decides what to do with the returned content (the endpoint saves an -ai copy).
//
// Auth: set CLAUDE_CODE_OAUTH_TOKEN in server/.env (generate it once on the host
// with `claude setup-token`). It is forwarded into the container by name only,
// so the value never appears on the command line or in the image.

import { spawn } from "node:child_process";
import readline from "node:readline";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { PAGES_DIR } from "./constants.js";
import { readManifest, ManifestEntry, writeManifest } from "./manifest.js";
import { slugify } from "./utils.js";

const IMAGE = "playable-agent";
// The agent writes a short version name here (see runner.ts SYSTEM prompt).
const VERSION_NAME_FILE = "__version_name.txt";

export interface AgentResult {
	/** The builder HTML after the agent edited it. */
	content: string;
	title: string | null;
}

/**
 * Runs the agent on a single file, streaming assistant text via `onText` as it
 * is produced. Resolves with the edited file contents plus the version name the
 * agent picked. Pass an AbortSignal to stop the container early (e.g. client
 * disconnect).
 */
export async function runAgentStream(
	filePath: string,
	prompt: string,
	messageCallback: (text: string) => void,
	signal?: AbortSignal
): Promise<AgentResult> {
	if (!process.env.CLAUDE_CODE_OAUTH_TOKEN) {
		throw new Error(
			"CLAUDE_CODE_OAUTH_TOKEN is not set. Run `claude setup-token` and put it in server/.env"
		);
	}

	if (!fs.existsSync(filePath)) throw new Error(`file not found: ${filePath}`);
	if (fs.statSync(filePath).isDirectory()) {
		throw new Error("runAgentStream expects a single file, not a directory");
	}

	const work = fs.mkdtempSync(path.join(os.tmpdir(), "playable-agent-"));
	const fileName = path.basename(filePath);
	const workFile = path.join(work, fileName);
	fs.copyFileSync(filePath, workFile);

	try {
		await dockerRun(work, prompt, messageCallback, signal);
		if (!fs.existsSync(workFile)) throw new Error("agent removed the file");
		const content = fs.readFileSync(workFile, "utf8");

		let title: string | null = null;
		const titlePath = path.join(work, VERSION_NAME_FILE);
		if (fs.existsSync(titlePath)) {
			const raw = fs.readFileSync(titlePath, "utf8").trim();
			if (raw) title = raw.split(/\r?\n/)[0].slice(0, 80).trim();
		}

		return { content, title };
	} finally {
		fs.rmSync(work, { recursive: true, force: true });
	}
}

/** Runs the container; inherits stderr (progress), parses stdout NDJSON. */
function dockerRun(
	workDir: string,
	prompt: string,
	messageCallback: (text: string) => void,
	signal?: AbortSignal
): Promise<void> {
	return new Promise((resolve, reject) => {
		const args = [
			"run",
			"--rm",
			"--user", "1000:1000",
			"--cap-drop", "ALL",
			"--pids-limit", "256",
			"--memory", "1g",
			"-v", `${workDir}:/work`,
			"-e", "CLAUDE_CODE_OAUTH_TOKEN",
			"-e", `AGENT_PROMPT=${prompt}`,
			IMAGE,
		];
		const dockerProcess = spawn("docker", args, { stdio: ["ignore", "pipe", "inherit"], env: process.env });

		const onAbort = () => dockerProcess.kill("SIGTERM");
		if (signal) {
			if (signal.aborted) onAbort();
			else signal.addEventListener("abort", onAbort, { once: true });
		}

		const rl = readline.createInterface({ input: dockerProcess.stdout });
		rl.on("line", (line) => {
			if (!line) return;
			try {
				const msg = JSON.parse(line) as { type?: string; text?: string };
				if (msg.type === "text" && typeof msg.text === "string") messageCallback(msg.text);
			} catch {
				/* ignore any non-JSON noise on stdout */
			}
		});

		dockerProcess.on("error", reject);
		dockerProcess.on("exit", (code) => {
			signal?.removeEventListener("abort", onAbort);
			if (signal?.aborted) return reject(new Error("aborted"));
			code === 0 ? resolve() : reject(new Error(`agent container exited with code ${code}`));
		});
	});
}

/**
 * Saves the agent's edited HTML as a NEW `-ai` copy (the original is never
 * overwritten) and appends a manifest entry for it. Returns the new entry.
 */
function saveAgentResult(
	fileName: string,
	content: string,
	title: string | null
): ManifestEntry {
	const manifest = readManifest();
	const original = manifest.pages.find((p) => p.file === fileName);

	// Pick a unique `*-ai.html` name within the pages dir.
	const base = slugify(fileName).replace(/-ai(-\d+)?$/i, "") + "-ai";
	let newFile = base + ".html";
	let n = 2;
	while (fs.existsSync(path.join(PAGES_DIR, newFile))) {
		newFile = base + "-" + n++ + ".html";
	}
	fs.writeFileSync(path.join(PAGES_DIR, newFile), content);

	// Title shows the source builder + the agent's version name, so it's clear
	// which version is which: "MyGame — Вертикальный заголовок".
	const baseName = (original?.title || fileName)
		.replace(/\.html?$/i, "")
		.replace(/\s*\(AI\)\s*$/i, "")
		.trim();

	const entry: ManifestEntry = {
		file: newFile,
		title: title ? `${baseName} — ${title}` : `${baseName} (AI)`,
		folder: original?.folder || "",
		uploaded: new Date().toISOString(),
	};
	manifest.pages.push(entry);
	writeManifest(manifest);

	return entry;
}

type AgentStreamingError = {
	status: number;
	message: string;
}
/**
 * Handles the streaming response from the agent. Returns an error if the
 * agent is not configured or the file does not exist.
 **/
export async function handleAgentStreaming(
	fileName: string,
	prompt: string,
	initStreamCallback: () => void,
	messageCallback: (text: string) => void,
	signal: AbortSignal,
	streamingEndCallback: (data?: string, event?: string) => void
): Promise<AgentStreamingError | null> {
	if (!process.env.CLAUDE_CODE_OAUTH_TOKEN) {
		return {
			status: 503,
			message: "AI агент не настроен: задайте CLAUDE_CODE_OAUTH_TOKEN на сервере."
		};
	}

	const filePath = path.join(PAGES_DIR, fileName);
	if (!fs.existsSync(filePath)) return { status: 404, message: "file not found" };

	initStreamCallback();

	try {
		const { content, title } = await runAgentStream(filePath, prompt, messageCallback, signal);
		const entry = saveAgentResult(fileName, content, title);
		streamingEndCallback(JSON.stringify(entry));
	} catch (e: any) {
		if (signal.aborted) {
			streamingEndCallback();
			return null;
		}
		console.error("[agent] error:", e?.message || e);
		streamingEndCallback(JSON.stringify(String(e?.message || "unknown")), "error");
	}

	return null;
}
