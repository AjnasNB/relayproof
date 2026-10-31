import { readFile, writeFile, mkdir } from "node:fs/promises";
import { cloudflareBackend, reviewPacket, validatePacket } from "./review.js";
const packet = validatePacket(
  JSON.parse(
    await readFile(process.argv[2] || "fixtures/shipment.json", "utf8"),
  ),
);
console.log("RelayProof / synthetic freight review / Mozaik4.2.0");
const result = await reviewPacket(
  packet,
  cloudflareBackend(),
  "Cloudflare Workers AI / llama-3.3-70b-instruct-fp8-fast",
);
await mkdir("artifacts", { recursive: true });
await writeFile(
  "artifacts/latest.json",
  JSON.stringify(result, null, 2) + "\n",
);
console.log(JSON.stringify(result, null, 2));
if (result.status === "incomplete") process.exitCode = 1;
