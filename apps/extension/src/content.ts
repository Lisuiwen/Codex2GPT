import type { JobMessage } from "@codex2gpt/protocol";
import { ChatGptAdapter } from "./chatgpt-adapter.js";

const adapter = new ChatGptAdapter();

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type !== "codex2gpt:run-job") return;

  const job = message.job as JobMessage;
  const startedAt = Date.now();

  adapter.execute(job.prompt, job.timeoutMs)
    .then((text) => {
      sendResponse({
        ok: true,
        text,
        durationMs: Date.now() - startedAt
      });
    })
    .catch((error) => {
      sendResponse({
        ok: false,
        error: error instanceof Error ? error.message : String(error),
        durationMs: Date.now() - startedAt
      });
    });

  return true;
});
