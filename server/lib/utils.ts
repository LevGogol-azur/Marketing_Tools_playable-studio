export function slugify(name?: string): string {
	return (
		(name || "page")
			.toLowerCase()
			.replace(/\.html?$/i, "")
			.replace(/[^a-z0-9]+/g, "-")
			.replace(/^-+|-+$/g, "")
			.slice(0, 80) || "page"
	);
}
