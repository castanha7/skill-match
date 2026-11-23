const DEFAULT_RETURN_PATH = "painel.html";
const ALLOWED_RETURN_PAGES = new Set(["painel.html", "perfil.html", "index.html"]);

/** Resolve a same-origin page return path; never allow protocol or host redirects. */
export function safeReturnPath(raw, baseUrl) {
  if (!raw) return DEFAULT_RETURN_PATH;
  try {
    const base = new URL(baseUrl);
    const destination = new URL(String(raw).trim(), base);
    if (destination.origin !== base.origin) return DEFAULT_RETURN_PATH;

    const baseDirectory = new URL(".", base).pathname;
    let pathname = destination.pathname;
    const filename = pathname.split("/").filter(Boolean).at(-1) || "";
    if (!filename.includes(".")) pathname += ".html";
    const resolvedFilename = pathname.split("/").filter(Boolean).at(-1) || "";
    if (!ALLOWED_RETURN_PAGES.has(resolvedFilename) || pathname !== `${baseDirectory}${resolvedFilename}`) {
      return DEFAULT_RETURN_PATH;
    }
    return `${pathname}${destination.search}${destination.hash}`;
  } catch {
    return DEFAULT_RETURN_PATH;
  }
}
