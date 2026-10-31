import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { once } from "node:events";
import { cloudflareBackend } from "../src/review.js";
test("bridge handles Workers AI structured objects and textual JSON; rejects missing response", async () => {
  let response: unknown = { findings: [] };
  const server = createServer((_req, res) => {
    res.setHeader("content-type", "application/json");
    res.end(JSON.stringify({ response }));
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  assert.ok(address && typeof address === "object");
  const backend = cloudflareBackend(`http://127.0.0.1:${address.port}/infer`);
  try {
    assert.deepEqual(JSON.parse(await backend([])), { findings: [] });
    response = '{"findings":[]}';
    assert.deepEqual(JSON.parse(await backend([])), { findings: [] });
    response = null;
    await assert.rejects(backend([]), /Missing/);
  } finally {
    server.close();
    server.closeAllConnections();
  }
});
