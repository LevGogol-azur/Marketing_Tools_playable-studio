// Manual test harness for the sandboxed agent.
//
//   npm run agent -- <file.html> "<prompt>"
//
// Reads CLAUDE_CODE_OAUTH_TOKEN from server/.env (via the --env-file flag in the
// npm script). Streams the agent's text to the console. Does NOT save — that's
// the endpoint's job (it writes an -ai copy).

import path from "node:path";
import { runAgentStream } from "./lib/claude.js";

const [, , fileArg, ...promptParts] = process.argv;
if (!fileArg || promptParts.length === 0) {
  console.error('Usage: npm run agent -- <file.html> "<prompt>"');
  process.exit(1);
}

runAgentStream(path.resolve(fileArg), promptParts.join(" "), (text) => {
  process.stdout.write(text);
})
  .then((res) => console.log(`\n\n[done] version: ${res.title ?? "(none)"}`))
  .catch((err) => {
    console.error("\n[agent] error:", err.message);
    process.exit(1);
  });
