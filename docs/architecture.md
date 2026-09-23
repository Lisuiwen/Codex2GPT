# Architecture

## Core rule

Codex knows jobs and logical sessions. Only the Chrome extension knows browser tabs and ChatGPT DOM selectors.

```text
Codex
  │ stdio MCP
  ▼
Broker
  │ localhost WebSocket
  ▼
Extension service worker
  │
  ▼
SessionPool
  │ sessionId → tabId + queue
  ▼
content script
  │
  ▼
ChatGptAdapter
```

## Broker

Responsibilities:

- expose MCP tools
- create job IDs
- forward jobs to the extension
- correlate async results
- enforce outer timeouts

The broker does not know ChatGPT DOM details.

## SessionPool

Logical sessions map to tabs:

```text
architecture → tab 101
bugs         → tab 104
tests        → tab 107
```

Concurrency rule:

- same session → serialized
- different sessions → parallel

This preserves one ChatGPT conversation per logical session while allowing multi-tab review.

## Batch flow

```text
gpt_review_batch
  ├─ architecture → tab A
  ├─ bugs         → tab B
  └─ tests        → tab C
          ↓
     Promise.all
          ↓
        Codex
```

## Why WebSocket for MVP

Native Messaging is possible but adds OS-level native-host installation.

Localhost WebSocket keeps setup small and provides bidirectional transport. Chrome 116+ can keep a Manifest V3 service worker alive when WebSocket traffic occurs inside the service-worker activity window; the extension therefore sends a heartbeat every 20 seconds.

## Fragile boundary

`apps/extension/src/chatgpt-adapter.ts` is the only layer that should know selectors such as the prompt composer, send button, stop button, and assistant message nodes.

If the ChatGPT UI changes, repair this adapter rather than the MCP/broker/session architecture.

## Failure behavior

- extension disconnected → MCP fails immediately
- dead tab → mapping is dropped; next call creates a new tab
- generation timeout → content script returns an error
- service-worker restart → MVP loses in-memory mappings

## Next phase

1. persist/recover `sessionId → tabId` with `chrome.storage.session`
2. add DOM diagnostics and adapter-version reporting
3. add max sessions + idle timeout + LRU cleanup
4. propagate MCP cancellation to “stop generating”
5. add file/context transport
6. add extension status panel
7. optionally replace WebSocket with Native Messaging

## Non-goals

- replacing Codex's primary model
- headless execution
- large-scale unattended automation
- treating the ChatGPT web UI as a stable API
