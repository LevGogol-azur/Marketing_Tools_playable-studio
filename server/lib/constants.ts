import path from "path";
import { fileURLToPath } from "url";

const here = path.dirname(fileURLToPath(import.meta.url)); // .../lib
const parent = path.dirname(here); // server root (tsx) OR dist/ (compiled)
// Anchor storage on the server package root so it stays `server/pages` whether we
// run in place (tsx, lib at server/lib) or compiled (lib at dist/lib).
export const ROOT = path.basename(parent) === "dist" ? path.join(parent, "..") : parent;
export const PAGES_DIR = path.join(ROOT, "pages");
export const MANIFEST = path.join(PAGES_DIR, "manifest.json");
export const PORT = process.env.PORT || 3000;
