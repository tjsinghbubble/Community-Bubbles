import { type Express } from "express";
import { createServer as createViteServer, createLogger } from "vite";
import { type Server } from "http";
import viteConfig from "../vite.config";
import fs from "fs";
import path from "path";
import { nanoid } from "nanoid";
import { isSpaDocumentRequest } from "./static";

const viteLogger = createLogger();

export async function setupVite(server: Server, app: Express) {
  const serverOptions = {
    middlewareMode: true,
    hmr: { server, path: "/vite-hmr" },
    allowedHosts: true as const,
  };

  const vite = await createViteServer({
    ...viteConfig,
    configFile: false,
    customLogger: {
      ...viteLogger,
      error: (msg, options) => {
        // Do NOT process.exit() here. The Vite dev middleware shares this Node process
        // with the API, so a single request that makes Vite throw (e.g. a junk path the
        // SPA catch-all feeds to import-analysis, like /.DS_Store) would otherwise take
        // the whole server down — an unauthenticated, single-request DoS. Log and keep
        // serving; the offending request gets a 500, the process survives.
        // Regression-guarded by tests/headless/infra/infra-0510-*.
        viteLogger.error(msg, options);
      },
    },
    server: serverOptions,
    appType: "custom",
  });

  app.use(vite.middlewares);

  app.use("/{*path}", async (req, res, next) => {
    // Only browser document navigations get the SPA shell; everything else falls through to a
    // 404 (matches the prod static server — see isSpaDocumentRequest). This also keeps junk
    // probes from being fed into Vite's index-html transform.
    if (!isSpaDocumentRequest(req)) return next();

    const url = req.originalUrl;

    try {
      const clientTemplate = path.resolve(
        import.meta.dirname,
        "..",
        "client",
        "index.html",
      );

      // always reload the index.html file from disk incase it changes
      let template = await fs.promises.readFile(clientTemplate, "utf-8");
      template = template.replace(
        `src="/src/main.tsx"`,
        `src="/src/main.tsx?v=${nanoid()}"`,
      );
      const page = await vite.transformIndexHtml(url, template);
      res.status(200).set({ "Content-Type": "text/html" }).end(page);
    } catch (e) {
      vite.ssrFixStacktrace(e as Error);
      next(e);
    }
  });

  // Non-HTML clients that fell through get a JSON 404, matching the prod static server.
  app.use((req, res) => {
    res.status(404).json({ error: "Not Found", path: req.originalUrl });
  });
}
