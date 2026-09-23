import {
  BRIDGE_VERSION,
  isJobMessage,
  type BrokerToExtensionMessage,
  type HeartbeatMessage,
  type HelloMessage
} from "@codex2gpt/protocol";
import { SessionPool } from "./session-pool.js";

const BRIDGE_URL = "ws://127.0.0.1:8765";
const RECONNECT_MS = 2_000;
const HEARTBEAT_MS = 20_000;

const pool = new SessionPool();

let socket: WebSocket | undefined;
let reconnectTimer: ReturnType<typeof setTimeout> | undefined;
let heartbeatTimer: ReturnType<typeof setInterval> | undefined;

function connect(): void {
  if (
    socket?.readyState === WebSocket.OPEN ||
    socket?.readyState === WebSocket.CONNECTING
  ) return;

  socket = new WebSocket(BRIDGE_URL);

  socket.addEventListener("open", () => {
    const hello: HelloMessage = { type: "hello", version: BRIDGE_VERSION };
    socket?.send(JSON.stringify(hello));

    if (heartbeatTimer) clearInterval(heartbeatTimer);
    heartbeatTimer = setInterval(() => {
      if (socket?.readyState !== WebSocket.OPEN) return;
      const heartbeat: HeartbeatMessage = { type: "heartbeat", at: Date.now() };
      socket.send(JSON.stringify(heartbeat));
    }, HEARTBEAT_MS);
  });

  socket.addEventListener("message", async (event) => {
    let message: BrokerToExtensionMessage;

    try {
      message = JSON.parse(String(event.data)) as BrokerToExtensionMessage;
    } catch {
      return;
    }

    if (!isJobMessage(message)) return;

    const result = await pool.run(message);

    if (socket?.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify(result));
    }
  });

  socket.addEventListener("close", scheduleReconnect);
  socket.addEventListener("error", scheduleReconnect);
}

function scheduleReconnect(): void {
  if (heartbeatTimer) {
    clearInterval(heartbeatTimer);
    heartbeatTimer = undefined;
  }

  if (reconnectTimer) return;

  reconnectTimer = setTimeout(() => {
    reconnectTimer = undefined;
    connect();
  }, RECONNECT_MS);
}

chrome.runtime.onInstalled.addListener(connect);
chrome.runtime.onStartup.addListener(connect);
connect();
