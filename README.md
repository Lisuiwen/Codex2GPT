# Codex2GPT

Use ChatGPT browser sessions as an external reviewer/tool from Codex.

```text
Codex
  │ MCP (stdio)
  ▼
Local Broker
  │ WebSocket
  ▼
Chrome Extension
  │
  ├─ session: review-a → ChatGPT tab A
  ├─ session: review-b → ChatGPT tab B
  └─ session: debug    → ChatGPT tab C
```

Different logical sessions can run in parallel; jobs sent to the same session are serialized.

> Experimental. The ChatGPT DOM adapter is isolated because web UI selectors can change. This project is not an official ChatGPT API.

## MVP

Implemented:

- Codex stdio MCP server
- localhost WebSocket bridge
- Chrome Manifest V3 extension
- logical `sessionId → tabId` mapping
- same-session queue / cross-session parallelism
- `gpt_ask`, `gpt_review`, `gpt_review_batch`, `gpt_bridge_status`
- isolated ChatGPT DOM adapter

Later:

- session recovery after Chrome/service-worker restart
- LRU tab cleanup / max concurrency
- cancellation
- file/image transport
- extension status UI
- model selector support

## Requirements

- Node.js 20+
- pnpm
- Chrome 116+
- logged-in `https://chatgpt.com`

## Install

```bash
pnpm install
pnpm build
```

### Load Chrome extension

1. Open `chrome://extensions`
2. Enable Developer mode
3. Load unpacked
4. Choose `apps/extension/dist`

The extension connects to `ws://127.0.0.1:8765`.

### Add to Codex

```toml
[mcp_servers.codex2gpt]
command = "node"
args = ["/ABSOLUTE/PATH/TO/Codex2GPT/apps/broker/dist/index.js"]
```

Verify:

```bash
codex mcp list
```

## Development

```bash
pnpm dev:broker
pnpm build:extension
```

See [docs/architecture.md](docs/architecture.md).
