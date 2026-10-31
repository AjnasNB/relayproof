import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
const files = new Map([
  ["/", ["index.html", "text/html; charset=utf-8"]],
  ["/receipt.json", ["receipt.json", "application/json"]],
  ["/packet.json", ["packet.json", "application/json"]],
]);
createServer(async (req, res) => {
  const entry = files.get(new URL(req.url, "http://localhost").pathname);
  if (req.method !== "GET" || !entry) {
    res.writeHead(404);
    res.end("Not found");
    return;
  }
  try {
    const body = await readFile(
      new URL("../docs/" + entry[0], import.meta.url),
    );
    res.writeHead(200, {
      "content-type": entry[1],
      "cache-control": "no-store",
    });
    res.end(body);
  } catch {
    res.writeHead(500);
    res.end("Recorded demo unavailable");
  }
}).listen(8790, "127.0.0.1", () =>
  console.log("Recorded demo: http://127.0.0.1:8790"),
);
