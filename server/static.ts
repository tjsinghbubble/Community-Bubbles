import express, { type Express, type Request } from "express";
import fs from "fs";
import path from "path";

/**
 * True only for browser document navigations that should receive the SPA shell: a GET/HEAD
 * whose Accept includes text/html. Everything else (modifying verbs, API-style/JSON clients,
 * forced-browse probes) must fall through to a 404 instead of being handed index.html with a
 * 200. Shared by the prod static server and the dev Vite middleware so both behave identically.
 *
 * NB: a bare client that sends no Accept (or Accept: * / *) does NOT get the SPA — only real
 * HTML navigations do. If an uptime check hits "/" without an HTML Accept and you need it to
 * get the page, point it at /api/v1/health (a real JSON health route) or relax this to also
 * accept "* / *".
 */
export function isSpaDocumentRequest(req: Pick<Request, "method" | "headers">): boolean {
  if (req.method !== "GET" && req.method !== "HEAD") return false;
  return String(req.headers.accept ?? "").includes("text/html");
}

export function serveStatic(app: Express) {
  const distPath = path.resolve(__dirname, "public");
  if (!fs.existsSync(distPath)) {
    throw new Error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`,
    );
  }

  app.use(express.static(distPath));

  // Fall through to index.html ONLY for browser document navigations (SPA deep links like
  // /explore, /bubble/123, and "/" itself). Non-HTML / non-GET requests get a 404, not the page.
  app.use("/{*path}", (req, res, next) => {
    if (!isSpaDocumentRequest(req)) return next();
    res.sendFile(path.resolve(distPath, "index.html"));
  });

  // Non-HTML clients that fell through (JSON clients, modifying verbs on unknown non-/api paths)
  // get a JSON 404, not Express's default HTML "Cannot GET" page.
  app.use((req, res) => {
    res.status(404).json({ error: "Not Found", path: req.originalUrl });
  });
}
