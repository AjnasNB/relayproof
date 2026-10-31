import test from "node:test";
import assert from "node:assert/strict";
import {
  reviewPacket,
  validatePacket,
  validateReport,
  deriveFacts,
  type Packet,
} from "../src/review.js";
const packet: Packet = {
  id: "test",
  synthetic: true,
  sources: [{ id: "a", text: "Quantity: 12 cartons." }],
};
const good = {
  findings: [
    {
      summary: "Confirm quantity",
      severity: "question",
      evidence: [{ sourceId: "a", quote: "12 cartons." }],
    },
  ],
  draft: "Please confirm the carton count.",
};
test("date arithmetic distinguishes late documents from a later departure", () => {
  const facts = deriveFacts({
    id: "test",
    synthetic: true,
    sources: [
      {
        id: "booking",
        text: "Booked quantity: 12 cartons. Documentation cutoff: 2026-10-31T12:00:00Z. Departure: 2026-11-01T03:00:00Z.",
      },
      { id: "handoff", text: "Documents expected at 2026-10-31T13:30:00Z." },
      { id: "packing", text: "Quantity: 10 cartons." },
    ],
  });
  assert.equal(facts.expectedDocumentsMinutesAfterCutoff, 90);
  assert.equal(facts.departureMinutesAfterCutoff, 900);
  assert.equal(facts.cartonMismatch, true);
});
test("rejects invented, missing or empty citations", () => {
  for (const quote of ["13 cartons.", "", "invented"])
    assert.throws(() =>
      validateReport(
        JSON.stringify({
          ...good,
          findings: [
            { ...good.findings[0], evidence: [{ sourceId: "a", quote }] },
          ],
        }),
        packet,
      ),
    );
  assert.throws(() =>
    validateReport(
      '{"findings":[{"summary":"release now","severity":"info","evidence":[]}]}',
      packet,
    ),
  );
});
test("rejects duplicate sources and oversized input", () => {
  assert.throws(() =>
    validatePacket({
      ...packet,
      sources: [packet.sources[0], packet.sources[0]],
    }),
  );
  assert.throws(() =>
    validatePacket({
      ...packet,
      sources: [{ id: "a", text: "a".repeat(9001) }],
    }),
  );
});
test("real Mozaik launches two overlapping loops then synthesizes once", async () => {
  let calls = 0;
  const result = await reviewPacket(
    packet,
    async () => {
      calls++;
      await new Promise((r) => setTimeout(r, 40));
      return JSON.stringify(good);
    },
    "TEST FIXTURE - no LLM",
  );
  assert.equal(calls, 3);
  assert.equal(result.maxConcurrentInferences, 2);
  assert.ok(result.overlapMs >= 20);
  assert.equal(result.status, "human_review_required");
  assert.equal(
    result.trace.filter(
      (x) => x.kind === "loop.start" && x.agent === "review-drafter",
    ).length,
    1,
  );
});
test("backend failure prevents synthesis and clears draft", async () => {
  let calls = 0;
  const result = await reviewPacket(
    packet,
    async () => {
      calls++;
      throw Error("offline");
    },
    "TEST FAILURE",
  );
  assert.equal(result.status, "incomplete");
  assert.equal(result.draft, "");
  assert.equal(calls, 2);
});
test("blockers remain gated after valid synthesis", async () => {
  const result = await reviewPacket(
    packet,
    async () =>
      JSON.stringify({
        ...good,
        findings: [{ ...good.findings[0], severity: "blocker" }],
      }),
    "TEST FIXTURE",
  );
  assert.equal(result.status, "blocked_for_review");
});
