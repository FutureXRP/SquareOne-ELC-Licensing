// Tiny API gateway for the local Supabase stack: one origin, like a hosted project.
//   /auth/v1/*    -> GoTrue      /rest/v1/* -> PostgREST      /storage/v1/* -> Storage
import http from "node:http";

const ROUTES = [
  ["/auth/v1", 54324],
  ["/rest/v1", 54325],
  ["/storage/v1", 54326],
];

http
  .createServer((req, res) => {
    // Browsers call Storage and Auth directly, from another origin. Hosted Supabase answers
    // CORS at its gateway; this does the same for local development.
    const cors = {
      "access-control-allow-origin": req.headers.origin ?? "*",
      "access-control-allow-methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS",
      "access-control-allow-headers": req.headers["access-control-request-headers"] ?? "authorization,apikey,content-type,x-client-info,x-upsert",
      "access-control-expose-headers": "content-range,x-supabase-api-version",
      "access-control-max-age": "600",
      vary: "Origin",
    };
    if (req.method === "OPTIONS") {
      res.writeHead(204, cors);
      res.end();
      return;
    }
    const route = ROUTES.find(([prefix]) => req.url === prefix || req.url.startsWith(prefix + "/") || req.url.startsWith(prefix + "?"));
    if (!route) {
      res.writeHead(404, { "content-type": "application/json" });
      res.end('{"message":"no route"}');
      return;
    }
    const [prefix, port] = route;
    const headers = { ...req.headers };
    // Like the hosted gateway: the API key is the token when no user token is sent.
    if (!headers.authorization && headers.apikey) headers.authorization = `Bearer ${headers.apikey}`;
    const upstream = http.request(
      { host: "127.0.0.1", port, method: req.method, path: req.url.slice(prefix.length) || "/", headers },
      (up) => {
        res.writeHead(up.statusCode ?? 502, { ...up.headers, ...cors });
        up.pipe(res);
      },
    );
    upstream.on("error", () => {
      res.writeHead(502, { "content-type": "application/json" });
      res.end('{"message":"upstream unavailable"}');
    });
    req.pipe(upstream);
  })
  .listen(54321, "127.0.0.1", () => console.log("Supabase local gateway on http://127.0.0.1:54321"));
