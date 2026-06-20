import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

const server = new Server({ name: "test", version: "1.0.0" }, { capabilities: { tools: {} } });
server.setRequestHandler(
  "tools/call",
  async (request) => {
    return { content: [{ type: "text", text: JSON.stringify(undefined) }] };
  }
);

console.log("Ready");
