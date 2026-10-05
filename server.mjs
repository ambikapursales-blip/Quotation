import { createServer } from "http";
import { parse } from "url";
import next from "next";

const dev = process.env.NODE_ENV !== "production";
const hostname = "localhost";
const port = parseInt(process.env.PORT || "3000", 10);

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

app.prepare().then(async () => {
  // Initialize MongoDB indexes in the background so the first user
  // request rarely blocks on cold connections. The server starts
  // listening immediately — initialization never blocks startup.
  import("./src/lib/db/mongodb.js")
    .then(({ initializeIndexes }) => {
      initializeIndexes()
        .then(() => {
          console.log("[server] MongoDB indexes initialized successfully");
        })
        .catch((err) => {
          console.warn("[server] MongoDB index initialization failed:", err.message);
        });
    })
    .catch((err) => {
      console.warn("[server] MongoDB module load failed:", err.message);
    });

  createServer((req, res) => {
    const parsedUrl = parse(req.url, true);
    handle(req, res, parsedUrl);
  }).listen(port, () => {
    console.log(
      `> Server ready on http://${hostname}:${port} (${dev ? "development" : "production"})`
    );
  });
});
