import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import { extname, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const requestedRoot = process.argv[2] === "dist" ? "dist" : ".";
const root = resolve(fileURLToPath(new URL(`../${requestedRoot}/`, import.meta.url)));
const port = Number.parseInt(process.env.PORT ?? "4173", 10);

const mimeTypes = new Map([
  [".css", "text/css; charset=utf-8"],
  [".html", "text/html; charset=utf-8"],
  [".js", "text/javascript; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".svg", "image/svg+xml"],
  [".webp", "image/webp"],
  [".png", "image/png"],
  [".ico", "image/x-icon"],
]);

const securityHeaders = {
  "Content-Security-Policy": [
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self'",
    "img-src 'self' data:",
    "font-src 'self'",
    "connect-src 'self'",
    "object-src 'none'",
    "base-uri 'none'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ].join("; "),
  "Cross-Origin-Opener-Policy": "same-origin",
  "Permissions-Policy": "camera=(), geolocation=(), microphone=()",
  "Referrer-Policy": "no-referrer",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
};

function send(response, statusCode, body, contentType = "text/plain; charset=utf-8") {
  response.writeHead(statusCode, {
    ...securityHeaders,
    "Content-Type": contentType,
  });
  response.end(body);
}

function resolveRequestPath(requestUrl) {
  const pathname = decodeURIComponent(new URL(requestUrl, "http://localhost").pathname);
  const relativePath = pathname === "/" ? "index.html" : pathname.replace(/^\/+/, "");
  const candidate = resolve(root, relativePath);

  if (candidate !== root && !candidate.startsWith(`${root}${sep}`)) {
    return null;
  }

  return candidate;
}

const server = createServer(async (request, response) => {
  if (request.method !== "GET" && request.method !== "HEAD") {
    send(response, 405, "Method not allowed");
    return;
  }

  const filePath = resolveRequestPath(request.url ?? "/");
  if (!filePath) {
    send(response, 400, "Invalid path");
    return;
  }

  try {
    const fileStat = await stat(filePath);
    if (!fileStat.isFile()) {
      send(response, 404, "Not found");
      return;
    }

    const body = request.method === "HEAD" ? "" : await readFile(filePath);
    send(
      response,
      200,
      body,
      mimeTypes.get(extname(filePath).toLowerCase()) ?? "application/octet-stream",
    );
  } catch (error) {
    if (error?.code === "ENOENT") {
      send(response, 404, "Not found");
      return;
    }

    console.error(error);
    send(response, 500, "Internal server error");
  }
});

server.listen(port, "127.0.0.1", () => {
  console.log(`Synthsara Node Zero serving ${root}`);
  console.log(`http://127.0.0.1:${port}`);
});
