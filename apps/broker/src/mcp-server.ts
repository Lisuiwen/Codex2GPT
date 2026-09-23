import { randomUUID } from "node:crypto";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { JobMessage } from "@codex2gpt/protocol";
import type { ExtensionBridge } from "./extension-bridge.js";

const DEFAULT_TIMEOUT_MS = 120_000;

function textResult(text: string, isError = false) {
  return {
    content: [{ type: "text" as const, text }],
    isError
  };
}

function newJob(
  prompt: string,
  sessionId: string,
  mode: JobMessage["mode"],
  timeoutMs: number
): JobMessage {
  return {
    type: "job",
    id: randomUUID(),
    sessionId,
    mode,
    prompt,
    timeoutMs,
    createdAt: Date.now()
  };
}

export function createMcpServer(bridge: ExtensionBridge): McpServer {
  const server = new McpServer({ name: "codex2gpt", version: "0.1.0" });

  server.tool(
    "gpt_ask",
    "Ask a ChatGPT browser session. Reuse session to continue the same conversation.",
    {
      prompt: z.string().min(1),
      session: z.string().min(1).optional(),
      timeoutMs: z.number().int().min(5_000).max(300_000).optional()
    },
    async ({ prompt, session, timeoutMs }) => {
      try {
        const result = await bridge.runJob(
          newJob(prompt, session ?? "default", "ask", timeoutMs ?? DEFAULT_TIMEOUT_MS)
        );
        return textResult(
          result.ok ? result.text ?? "" : result.error ?? "Unknown browser error",
          !result.ok
        );
      } catch (error) {
        return textResult(error instanceof Error ? error.message : String(error), true);
      }
    }
  );

  server.tool(
    "gpt_review",
    "Send code, a diff, plan, or technical decision to an isolated ChatGPT reviewer session.",
    {
      task: z.string().min(1),
      context: z.string().optional(),
      session: z.string().min(1).optional(),
      timeoutMs: z.number().int().min(5_000).max(300_000).optional()
    },
    async ({ task, context, session, timeoutMs }) => {
      const prompt = [
        "Act as a senior code reviewer.",
        "Focus on correctness, regressions, missing cases, architecture risks, and actionable fixes.",
        "Do not rewrite everything unless necessary.",
        "",
        "Task:",
        task,
        context ? `\nContext:\n${context}` : ""
      ].join("\n");

      try {
        const result = await bridge.runJob(
          newJob(
            prompt,
            session ?? `review-${randomUUID()}`,
            "review",
            timeoutMs ?? DEFAULT_TIMEOUT_MS
          )
        );
        return textResult(
          result.ok ? result.text ?? "" : result.error ?? "Unknown browser error",
          !result.ok
        );
      } catch (error) {
        return textResult(error instanceof Error ? error.message : String(error), true);
      }
    }
  );

  server.tool(
    "gpt_review_batch",
    "Run independent ChatGPT review prompts concurrently in separate browser sessions.",
    {
      items: z.array(z.object({
        label: z.string().min(1),
        prompt: z.string().min(1),
        session: z.string().min(1).optional()
      })).min(1).max(6),
      timeoutMs: z.number().int().min(5_000).max(300_000).optional()
    },
    async ({ items, timeoutMs }) => {
      const batchId = randomUUID();
      const effectiveTimeout = timeoutMs ?? DEFAULT_TIMEOUT_MS;

      const results = await Promise.all(items.map(async (item, index) => {
        try {
          const result = await bridge.runJob(
            newJob(
              item.prompt,
              item.session ?? `batch-${batchId}-${index}`,
              "review",
              effectiveTimeout
            )
          );
          return {
            label: item.label,
            ok: result.ok,
            text: result.text,
            error: result.error,
            durationMs: result.durationMs
          };
        } catch (error) {
          return {
            label: item.label,
            ok: false,
            error: error instanceof Error ? error.message : String(error)
          };
        }
      }));

      return textResult(JSON.stringify(results, null, 2));
    }
  );

  server.tool(
    "gpt_bridge_status",
    "Check whether the Codex2GPT browser extension is connected.",
    {},
    async () => textResult(JSON.stringify({ connected: bridge.isConnected() }))
  );

  return server;
}
