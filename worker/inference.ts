// Local Wrangler dev bridge. Do not expose this endpoint publicly.
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method === "GET" && new URL(request.url).pathname === "/health")
      return Response.json({ ok: true });
    if (request.method !== "POST" || new URL(request.url).pathname !== "/infer")
      return new Response("Not found", { status: 404 });
    if (Number(request.headers.get("content-length") || 0) > 20000)
      return new Response("Too large", { status: 413 });
    const reader = request.body?.getReader();
    if (!reader) return new Response("Body required", { status: 400 });
    const chunks: Uint8Array[] = [];
    let size = 0;
    while (true) {
      const part = await reader.read();
      if (part.done) break;
      size += part.value.byteLength;
      if (size > 20000) {
        await reader.cancel();
        return new Response("Too large", { status: 413 });
      }
      chunks.push(part.value);
    }
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.length;
    }
    try {
      const body = JSON.parse(new TextDecoder().decode(bytes));
      if (
        !Array.isArray(body.messages) ||
        body.messages.length > 4 ||
        body.messages.some(
          (m: { role?: string; content?: string }) =>
            !["system", "user", "assistant"].includes(m.role || "") ||
            typeof m.content !== "string",
        )
      )
        return new Response("Invalid messages", { status: 400 });
      const result = await env.AI.run(
        "@cf/meta/llama-3.3-70b-instruct-fp8-fast",
        {
          messages: body.messages,
          max_tokens: 700,
          temperature: 0,
          response_format: { type: "json_object" },
        },
      );
      return Response.json(result, {
        headers: { "cache-control": "no-store" },
      });
    } catch {
      return Response.json(
        { error: "Inference failed; no review decision available" },
        { status: 502 },
      );
    }
  },
} satisfies ExportedHandler<Env>;
