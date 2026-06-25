import fs from "fs";
import { MANIFEST } from "./constants.js";

export interface ManifestEntry {
	file: string;
	title: string;
	folder: string;
	uploaded: string;
}
export interface Manifest {
	pages: ManifestEntry[];
}


export function readManifest(): Manifest {
	try {
		const m = JSON.parse(fs.readFileSync(MANIFEST, "utf8")) as Manifest;
		if (!Array.isArray(m.pages)) m.pages = [];
		return m;
	} catch {
		return { pages: [] };
	}
}

export function writeManifest(m: Manifest): void {
	fs.writeFileSync(MANIFEST, JSON.stringify(m, null, 2) + "\n");
}
