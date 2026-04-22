import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import type { Config } from './config.js';
import type { IAgentExecutor } from './ports/agentExecutor.js';
import { wrapTool, type PipelineContext } from './pipeline/toolPipeline.js';
import { ALL_PROMPTS } from './registry/prompts.js';
import { ALL_RESOURCES } from './registry/resources.js';
import { ALL_TOOLS } from './registry/tools.js';

/**
 * Wire MCP transport + registries. Transport owns stdout — never log to stdout here.
 */
export function startServer(executor: IAgentExecutor, config: Config): void {
  void connectServer(executor, config);
}

async function connectServer(executor: IAgentExecutor, config: Config): Promise<void> {
  const mcp = new McpServer(
    {
      name: 'cursor-cli-mcp',
      version: '0.1.0',
      description: "MCP server for controlling Cursor's agent CLI",
    },
    {},
  );

  const ctx: PipelineContext = { workspaceAllowlist: config.workspaceAllowlist };

  for (const tool of ALL_TOOLS) {
    const handler = wrapTool(tool, executor, ctx);
    mcp.registerTool(
      tool.name,
      { description: tool.description, inputSchema: tool.schema },
      async (args) => handler(args),
    );
  }

  for (const res of ALL_RESOURCES) {
    mcp.registerResource(
      res.name,
      res.uri,
      { description: res.description ?? res.name, mimeType: res.mimeType },
      async () => ({
        contents: [{ uri: res.uri, mimeType: res.mimeType, text: res.content }],
      }),
    );
  }

  for (const p of ALL_PROMPTS) {
    if (p.argsSchema) {
      mcp.registerPrompt(
        p.name,
        { description: p.description, argsSchema: p.argsSchema },
        async () => ({
          messages: [],
        }),
      );
    } else {
      mcp.registerPrompt(p.name, { description: p.description ?? p.name }, async () => ({
        messages: [],
      }));
    }
  }

  const transport = new StdioServerTransport();
  await mcp.connect(transport);
}
