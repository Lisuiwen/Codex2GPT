export const BRIDGE_VERSION = "0.1.0";

export type JobMode = "ask" | "review";

export interface HelloMessage {
  type: "hello";
  version: string;
  capacity?: number;
}

export interface HeartbeatMessage {
  type: "heartbeat";
  at: number;
}

export interface JobMessage {
  type: "job";
  id: string;
  sessionId: string;
  mode: JobMode;
  prompt: string;
  timeoutMs: number;
  createdAt: number;
}

export interface JobResultMessage {
  type: "result";
  id: string;
  sessionId: string;
  ok: boolean;
  text?: string;
  error?: string;
  durationMs: number;
}

export type ExtensionToBrokerMessage =
  | HelloMessage
  | HeartbeatMessage
  | JobResultMessage;

export type BrokerToExtensionMessage = JobMessage;

export function isJobMessage(value: unknown): value is JobMessage {
  if (!value || typeof value !== "object") return false;
  const message = value as Partial<JobMessage>;
  return (
    message.type === "job" &&
    typeof message.id === "string" &&
    typeof message.sessionId === "string" &&
    typeof message.prompt === "string" &&
    typeof message.timeoutMs === "number"
  );
}

export function isJobResultMessage(value: unknown): value is JobResultMessage {
  if (!value || typeof value !== "object") return false;
  const message = value as Partial<JobResultMessage>;
  return (
    message.type === "result" &&
    typeof message.id === "string" &&
    typeof message.sessionId === "string" &&
    typeof message.ok === "boolean" &&
    typeof message.durationMs === "number"
  );
}
