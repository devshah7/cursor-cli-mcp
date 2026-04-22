import { AgentCliExecutor } from './adapters/agentCli/executor.js';
import { ConfigError, loadConfig } from './config.js';
import { startServer } from './server.js';

try {
  const config = loadConfig();
  const executor = new AgentCliExecutor(config);
  startServer(executor, config);

  const shutdown = () => {
    void executor.shutdown().finally(() => process.exit(0));
  };
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
} catch (e) {
  if (e instanceof ConfigError) {
    process.stderr.write(`${e.message}\n`);
    process.exit(1);
  }
  throw e;
}
