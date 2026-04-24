import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import type { RequestHandlerExtra } from '@modelcontextprotocol/sdk/shared/protocol.js';
import type { ServerNotification, ServerRequest } from '@modelcontextprotocol/sdk/types.js';
import type { Config } from './config.js';
import type { IAgentExecutor } from './ports/agentExecutor.js';
import { wrapTool, type PipelineContext } from './pipeline/toolPipeline.js';
import { createLogger } from './logger.js';
import { registerPromptHandlers } from './registry/prompts.js';
import { ALL_RESOURCES } from './registry/resources.js';
import { buildToolDescriptors } from './registry/tools.js';

/**
 * Wire MCP transport + registries. Transport owns stdout — never log to stdout here.
 */
export function startServer(executor: IAgentExecutor, config: Config): void {
  void connectServer(executor, config);
}

async function connectServer(executor: IAgentExecutor, config: Config): Promise<void> {
  const logger = createLogger(config);

  const mcp = new McpServer(
    {
      name: 'cursor-cli-mcp',
      version: '0.1.0',
      description: "MCP server for controlling Cursor's agent CLI",
    },
    {
      capabilities: {
        logging: {},
      },
    },
  );

  const ctx: PipelineContext = {
    workspaceAllowlist: config.workspaceAllowlist,
    agentBinaryPath: config.agentBinaryPath,
    agentTimeoutMs: config.agentTimeoutMs,
    sessionCreateTimeoutMs: config.sessionCreateTimeoutMs,
    maxOutputBytes: config.maxOutputBytes,
    logger,
  };

  for (const tool of buildToolDescriptors(config)) {
    const handler = wrapTool(tool, executor, ctx);
    mcp.registerTool(
      tool.name,
      { description: tool.description, inputSchema: tool.schema },
      async (args, extra: RequestHandlerExtra<ServerRequest, ServerNotification>) => {
        if (tool.name !== 'run_agent') {
          return handler(args);
        }
        const sendNotification = (chunk: string): void => {
          void mcp.server
            .sendLoggingMessage(
              {
                level: 'debug',
                logger: 'cursor-cli-mcp.run_agent.stdout',
                data: { chunk },
              },
              extra.sessionId,
            )
            .catch(() => undefined);
        };
        const streamCtx: Partial<PipelineContext> = { sendNotification };
        return handler(args, streamCtx);
      },
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

  registerPromptHandlers(mcp);

  const transport = new StdioServerTransport();
  await mcp.connect(transport);
}
