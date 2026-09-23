import {
  BRIDGE_VERSION,
  isJobResultMessage,
  type ExtensionToBrokerMessage,
  type JobMessage,
  type JobResultMessage
} from "@codex2gpt/protocol";
import { WebSocket, WebSocketServer } from "ws";

interface PendingJob {
  resolve: (value: JobResultMessage) => void;
  reject: (error: Error) => void;
  timer: NodeJS.Timeout;
}

export class ExtensionBridge {
  private wss?: WebSocketServer;
  private socket?: WebSocket;
  private readonly pending = new Map<string, PendingJob>();

  constructor(private readonly port: number) {}

  async start(): Promise<void> {
    if (this.wss) return;

    this.wss = new WebSocketServer({ host: "127.0.0.1", port: this.port });

    this.wss.on("connection", (socket, request) => {
      const origin = request.headers.origin ?? "";

      if (!origin.startsWith("chrome-extension://")) {
        socket.close(1008, "Codex2GPT only accepts Chrome extension connections");
        return;
      }

      if (this.socket && this.socket.readyState === WebSocket.OPEN) {
        this.socket.close(1012, "Replaced by newer Codex2GPT extension connection");
      }

      this.socket = socket;

      socket.on("message", (raw) => this.onMessage(raw.toString()));
      socket.on("close", () => {
        if (this.socket === socket) this.socket = undefined;
      });
      socket.on("error", (error) => {
        process.stderr.write(`[codex2gpt] extension socket error: ${String(error)}\n`);
      });
    });

    await new Promise<void>((resolve, reject) => {
      this.wss?.once("listening", resolve);
      this.wss?.once("error", reject);
    });

    process.stderr.write(
      `[codex2gpt] bridge v${BRIDGE_VERSION} listening on ws://127.0.0.1:${this.port}\n`
    );
  }

  isConnected(): boolean {
    return this.socket?.readyState === WebSocket.OPEN;
  }

  runJob(job: JobMessage): Promise<JobResultMessage> {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
      throw new Error("Codex2GPT extension is not connected. Load the extension and keep Chrome running.");
    }

    return new Promise<JobResultMessage>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(job.id);
        reject(new Error(`ChatGPT browser job timed out after ${job.timeoutMs}ms`));
      }, job.timeoutMs + 5_000);

      this.pending.set(job.id, { resolve, reject, timer });

      try {
        this.socket?.send(JSON.stringify(job));
      } catch (error) {
        clearTimeout(timer);
        this.pending.delete(job.id);
        reject(error instanceof Error ? error : new Error(String(error)));
      }
    });
  }

  private onMessage(raw: string): void {
    let message: ExtensionToBrokerMessage;

    try {
      message = JSON.parse(raw) as ExtensionToBrokerMessage;
    } catch {
      return;
    }

    if (message.type === "hello") {
      process.stderr.write(
        `[codex2gpt] extension connected (version=${message.version})\n`
      );
      return;
    }

    if (message.type === "heartbeat") return;
    if (!isJobResultMessage(message)) return;

    const pending = this.pending.get(message.id);
    if (!pending) return;

    clearTimeout(pending.timer);
    this.pending.delete(message.id);
    pending.resolve(message);
  }
}
