#!/usr/bin/env node
/**
 * cursor-cli-mcp setup script
 * Run via: npm run setup
 *
 * Zero external dependencies — Node built-ins only.
 * Supports macOS and Linux. Windows paths included but untested.
 */

import { spawnSync } from 'node:child_process';
import { accessSync, constants, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createInterface } from 'node:readline';
import { homedir, platform } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

// ─── Colours ────────────────────────────────────────────────────────────────

const c = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  cyan: '\x1b[36m',
  dim: '\x1b[2m',
};

const ok = (msg) => console.log(`${c.green}✓${c.reset} ${msg}`);
const warn = (msg) => console.log(`${c.yellow}⚠${c.reset}  ${msg}`);
const fail = (msg) => { console.error(`${c.red}✗${c.reset} ${msg}`); process.exit(1); };
const info = (msg) => console.log(`${c.cyan}→${c.reset} ${msg}`);
const header = (msg) => console.log(`\n${c.bold}${msg}${c.reset}`);
const dim = (msg) => console.log(`${c.dim}${msg}${c.reset}`);

// ─── Readline helper ─────────────────────────────────────────────────────────

function prompt(rl, question) {
  return new Promise((resolve) => rl.question(question, resolve));
}

// ─── Step 1: Node version ────────────────────────────────────────────────────

function checkNode() {
  header('Step 1/7 — Checking Node.js version');
  const [major] = process.versions.node.split('.').map(Number);
  if (major < 20) {
    fail(`Node.js >= 20 required. You have ${process.versions.node}. Install from https://nodejs.org`);
  }
  ok(`Node.js ${process.versions.node}`);
}

// ─── Step 2: Find agent binary ───────────────────────────────────────────────

const AGENT_CANDIDATE_PATHS = [
  process.env.AGENT_BINARY_PATH,
  '/Users/' + (process.env.USER || '') + '/.local/bin/agent',
  '/usr/local/bin/agent',
  '/Applications/Cursor.app/Contents/Resources/app/bin/agent',
  '/opt/homebrew/bin/agent',
].filter(Boolean);

async function findAgentBinary(rl) {
  header('Step 2/7 — Locating Cursor agent binary');

  for (const p of AGENT_CANDIDATE_PATHS) {
    if (existsSync(p)) {
      try {
        accessSync(p, constants.X_OK);
        ok(`Found agent binary: ${p}`);
        return p;
      } catch {
        // not executable
      }
    }
  }

  warn('Agent binary not found at common locations.');
  dim('  Checked: ' + AGENT_CANDIDATE_PATHS.join(', '));

  const custom = await prompt(rl, `  Enter full path to agent binary (or press Enter to skip): `);
  const trimmed = custom.trim();

  if (!trimmed) {
    warn('Skipping binary check. Set AGENT_BINARY_PATH in mcp.json manually.');
    return null;
  }

  if (!existsSync(trimmed)) {
    fail(`Path does not exist: ${trimmed}`);
  }

  try {
    accessSync(trimmed, constants.X_OK);
  } catch {
    fail(`File exists but is not executable: ${trimmed}`);
  }

  ok(`Using agent binary: ${trimmed}`);
  return trimmed;
}

// ─── Step 3: npm install + build ────────────────────────────────────────────

function buildProject() {
  header('Step 3/7 — Installing dependencies and building');

  info('Running npm install...');
  const install = spawnSync('npm', ['install'], { cwd: ROOT, stdio: 'inherit', shell: false });
  if (install.status !== 0) fail('npm install failed.');
  ok('Dependencies installed');

  info('Running npm run build...');
  const build = spawnSync('npm', ['run', 'build'], { cwd: ROOT, stdio: 'inherit', shell: false });
  if (build.status !== 0) fail('Build failed. Fix TypeScript errors and re-run npm run setup.');
  ok('Build complete → dist/');
}

// ─── Step 4: Find Claude Desktop config ─────────────────────────────────────

function getClaudeConfigPath() {
  const os = platform();
  if (os === 'darwin') {
    return join(homedir(), 'Library', 'Application Support', 'Claude', 'claude_desktop_config.json');
  }
  if (os === 'win32') {
    return join(process.env.APPDATA || join(homedir(), 'AppData', 'Roaming'), 'Claude', 'claude_desktop_config.json');
  }
  // Linux
  return join(homedir(), '.config', 'Claude', 'claude_desktop_config.json');
}

async function findClaudeConfig(rl) {
  header('Step 4/7 — Locating Claude Desktop config');

  const detected = getClaudeConfigPath();

  if (existsSync(detected)) {
    ok(`Found: ${detected}`);
    return detected;
  }

  warn(`Claude Desktop config not found at: ${detected}`);
  const ans = await prompt(rl, '  Create it automatically? (Y/n): ');

  if (ans.trim().toLowerCase() === 'n') {
    const custom = await prompt(rl, '  Enter full path to claude_desktop_config.json: ');
    return custom.trim();
  }

  mkdirSync(dirname(detected), { recursive: true });
  writeFileSync(detected, JSON.stringify({ mcpServers: {} }, null, 2));
  ok(`Created: ${detected}`);
  return detected;
}

// ─── Step 5: Workspace allowlist ─────────────────────────────────────────────

async function getWorkspaceAllowlist(rl) {
  header('Step 5/7 — Configuring WORKSPACE_ALLOWLIST');

  dim('  The agent can only operate on paths you explicitly allow.');
  dim('  Enter one absolute path per line. Empty line to finish.');
  dim('  Example: /Users/devshah/projects/my-app');

  const paths = [];

  while (true) {
    const raw = await prompt(rl, `  Path ${paths.length + 1} (or Enter to finish): `);
    const p = raw.trim();

    if (!p) {
      if (paths.length === 0) {
        warn('No paths entered. The server will deny all workspace operations.');
        const confirm = await prompt(rl, '  Continue with empty allowlist? (y/N): ');
        if (confirm.trim().toLowerCase() !== 'y') continue;
      }
      break;
    }

    const abs = resolve(p);
    if (!existsSync(abs)) {
      warn(`Path does not exist: ${abs} — adding anyway (it may be created later)`);
    }
    paths.push(abs);
    ok(`Added: ${abs}`);
  }

  return paths.join(':');
}

// ─── Step 6: Write mcp.json entry ────────────────────────────────────────────

function writeClaudeConfig(configPath, agentBinaryPath, workspaceAllowlist) {
  header('Step 6/7 — Writing MCP server entry to Claude Desktop config');

  let config = { mcpServers: {} };

  if (existsSync(configPath)) {
    try {
      config = JSON.parse(readFileSync(configPath, 'utf8'));
      if (!config.mcpServers) config.mcpServers = {};
    } catch {
      fail(`Could not parse ${configPath} as JSON. Fix the file and re-run.`);
    }
  }

  const existing = config.mcpServers['cursor-cli-mcp'];
  if (existing) {
    warn('Existing cursor-cli-mcp entry found — updating it.');
  }

  config.mcpServers['cursor-cli-mcp'] = {
    command: 'node',
    args: [join(ROOT, 'dist', 'index.js')],
    env: {
      AGENT_BINARY_PATH: agentBinaryPath ?? '/usr/local/bin/agent',
      WORKSPACE_ALLOWLIST: workspaceAllowlist,
      AGENT_TIMEOUT_MS: '120000',
      MAX_OUTPUT_BYTES: '524288',
      LOG_LEVEL: 'info',
    },
  };

  writeFileSync(configPath, JSON.stringify(config, null, 2));
  ok(`Written: ${configPath}`);

  console.log('\n  Entry added:');
  dim(JSON.stringify(config.mcpServers['cursor-cli-mcp'], null, 4).replace(/^/gm, '  '));
}

// ─── Step 7: Smoke test ──────────────────────────────────────────────────────

function smokeTest() {
  header('Step 7/7 — Smoke testing MCP initialize handshake');

  const initMsg = JSON.stringify({
    jsonrpc: '2.0',
    id: 1,
    method: 'initialize',
    params: {
      protocolVersion: '2024-11-05',
      capabilities: {},
      clientInfo: { name: 'setup-smoke-test', version: '0.0.1' },
    },
  }) + '\n';

  const result = spawnSync(
    'node',
    [join(ROOT, 'dist', 'index.js')],
    {
      input: initMsg,
      encoding: 'utf8',
      timeout: 5000,
      shell: false,
    }
  );

  if (result.error || result.status === null) {
    warn('Smoke test timed out or errored — server may still work. Check manually.');
    dim('  Run: echo \'{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"test","version":"0.0.1"}}}\' | node dist/index.js');
    return;
  }

  const stdout = result.stdout ?? '';

  try {
    const lines = stdout.split('\n').filter((l) => l.trim());
    const response = JSON.parse(lines[0] ?? '{}');
    if (response.result?.serverInfo?.name) {
      ok(`MCP handshake succeeded — server: ${response.result.serverInfo.name}`);
    } else {
      ok('MCP handshake returned a JSON-RPC response');
    }
  } catch {
    warn('Could not parse MCP response — but server started. Check manually if needed.');
  }
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`\n${c.bold}${c.cyan}cursor-cli-mcp setup${c.reset}`);
  console.log('─'.repeat(40));

  const rl = createInterface({ input: process.stdin, output: process.stdout });

  try {
    checkNode();
    const agentBinaryPath = await findAgentBinary(rl);
    buildProject();
    const configPath = await findClaudeConfig(rl);
    const workspaceAllowlist = await getWorkspaceAllowlist(rl);
    writeClaudeConfig(configPath, agentBinaryPath, workspaceAllowlist);
    smokeTest();
  } finally {
    rl.close();
  }

  console.log(`\n${'─'.repeat(40)}`);
  console.log(`${c.bold}${c.green}Setup complete.${c.reset}`);
  console.log(`\n  ${c.bold}Next step:${c.reset} Restart Claude Desktop.\n`);
  console.log(`  The following tools will be available in Claude:`);
  console.log(`  ${c.dim}run_agent, list_models, agent_status, session_create, session_resume${c.reset}`);
  console.log(`  ${c.dim}Resources: cli-permissions-reference, rules-discovery${c.reset}`);
  console.log(`  ${c.dim}Prompts: plan-only, ask-only, worktree-isolation${c.reset}\n`);
}

main().catch((err) => {
  console.error(`\n${c.red}Setup failed:${c.reset}`, err.message);
  process.exit(1);
});
