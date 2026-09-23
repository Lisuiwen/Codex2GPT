import type { JobMessage, JobResultMessage } from "@codex2gpt/protocol";

interface SessionEntry {
  tabId: number;
  tail: Promise<void>;
  lastUsedAt: number;
}

interface ContentJobResponse {
  ok: boolean;
  text?: string;
  error?: string;
  durationMs: number;
}

export class SessionPool {
  private readonly sessions = new Map<string, SessionEntry>();
  private readonly opening = new Map<string, Promise<SessionEntry>>();

  async run(job: JobMessage): Promise<JobResultMessage> {
    const entry = await this.ensureSession(job.sessionId);

    let release!: () => void;
    const previous = entry.tail;
    entry.tail = new Promise<void>((resolve) => {
      release = resolve;
    });

    await previous;

    try {
      entry.lastUsedAt = Date.now();

      const response = await chrome.tabs.sendMessage(entry.tabId, {
        type: "codex2gpt:run-job",
        job
      }) as ContentJobResponse;

      return {
        type: "result",
        id: job.id,
        sessionId: job.sessionId,
        ok: response.ok,
        text: response.text,
        error: response.error,
        durationMs: response.durationMs
      };
    } catch (error) {
      this.sessions.delete(job.sessionId);

      return {
        type: "result",
        id: job.id,
        sessionId: job.sessionId,
        ok: false,
        error: error instanceof Error ? error.message : String(error),
        durationMs: 0
      };
    } finally {
      release();
    }
  }

  private async ensureSession(sessionId: string): Promise<SessionEntry> {
    const current = this.sessions.get(sessionId);

    if (current && await this.tabExists(current.tabId)) {
      return current;
    }

    const inFlight = this.opening.get(sessionId);
    if (inFlight) return inFlight;

    const opening = this.openSession(sessionId);
    this.opening.set(sessionId, opening);

    try {
      return await opening;
    } finally {
      this.opening.delete(sessionId);
    }
  }

  private async openSession(sessionId: string): Promise<SessionEntry> {
    const tab = await chrome.tabs.create({
      url: "https://chatgpt.com/",
      active: false
    });

    if (tab.id == null) throw new Error("Chrome did not return a tab id");

    await this.waitForTabReady(tab.id);

    const entry: SessionEntry = {
      tabId: tab.id,
      tail: Promise.resolve(),
      lastUsedAt: Date.now()
    };

    this.sessions.set(sessionId, entry);
    return entry;
  }

  private async tabExists(tabId: number): Promise<boolean> {
    try {
      await chrome.tabs.get(tabId);
      return true;
    } catch {
      return false;
    }
  }

  private waitForTabReady(tabId: number, timeoutMs = 20_000): Promise<void> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        cleanup();
        reject(new Error("Timed out waiting for ChatGPT tab to load"));
      }, timeoutMs);

      const listener = (
        updatedTabId: number,
        changeInfo: chrome.tabs.TabChangeInfo
      ) => {
        if (updatedTabId === tabId && changeInfo.status === "complete") {
          cleanup();
          setTimeout(resolve, 300);
        }
      };

      const cleanup = () => {
        clearTimeout(timer);
        chrome.tabs.onUpdated.removeListener(listener);
      };

      chrome.tabs.onUpdated.addListener(listener);

      chrome.tabs.get(tabId).then((tab) => {
        if (tab.status === "complete") {
          cleanup();
          setTimeout(resolve, 300);
        }
      }).catch(() => {});
    });
  }
}
