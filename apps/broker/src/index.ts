import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { ExtensionBridge } from "./extension-bridge.js";
import { createMcpServer } from "./mcp-server.js";

const port = Number(process.env.CODEX2GPT_PORT ?? 8765);

const bridge = new ExtensionBridge(port);
await bridge.start();

const server = createMcpServer(bridge);
const transport = new StdioServerTransport();

await server.connect(transport);

process.stderr.write("[codex2gpt] MCP server connected over stdio\n");
