import { z } from 'zod';
import { buildSessionListArgs } from '../adapters/agentCli/argBuilder.js';
import type { PipelineContext } from '../pipeline/toolPipeline.js';
import type { ExecutorResult } from '../ports/executorTypes.js';
import type { IAgentExecutor } from '../ports/agentExecutor.js';
import type { ToolDescriptor } from '../registry/tools.js';

export const sessionListSchema = z.object({
  limit: z.number().int().min(1).max(100).optional().default(20),
});

export type SessionListParsed = z.infer<typeof sessionListSchema>;

export type SessionListEntry = {
  id: string;
  /** ISO timestamp when parsed from structured output; empty string when unknown. */
  createdAt: string;
  title?: string;
};

function stripAnsi(s: string): string {
  return s.replace(/\x1b\[[0-9;]*m/g, '');
}

const UUID_RE = /[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}/g;

function normalizeEntry(raw: unknown): SessionListEntry | null {
  if (typeof raw === 'string') {
    const trimmed = raw.trim();
    return trimmed.length > 0 ? { id: trimmed, createdAt: '' } : null;
  }
  if (!raw || typeof raw !== 'object') {
    return null;
  }
  const o = raw as Record<string, unknown>;
  const idRaw = o.id ?? o.chatId ?? o.sessionId;
  const id = typeof idRaw === 'string' ? idRaw.trim() : '';
  if (!id) {
    return null;
  }
  const title =
    typeof o.title === 'string' ? o.title : typeof o.name === 'string' ? o.name : undefined;
  let createdAt = '';
  if (typeof o.createdAt === 'string') {
    createdAt = o.createdAt;
  } else if (typeof o.created === 'string') {
    createdAt = o.created;
  } else if (typeof o.updatedAt === 'string') {
    createdAt = o.updatedAt;
  }
  const entry: SessionListEntry = { id, createdAt };
  if (title !== undefined) {
    entry.title = title;
  }
  return entry;
}

/**
 * Parse `agent ls` stdout. Output format varies (TUI vs scriptable); supports JSON-ish shapes
 * and line-oriented UUID extraction as a fallback.
 */
export function parseSessionListStdout(stdout: string, limit: number): SessionListEntry[] {
  const cleaned = stripAnsi(stdout).trim();
  if (cleaned === '') {
    return [];
  }
  try {
    const j: unknown = JSON.parse(cleaned);
    const rows: SessionListEntry[] = [];
    if (Array.isArray(j)) {
      for (const item of j) {
        const e = normalizeEntry(item);
        if (e) {
          rows.push(e);
        }
      }
    } else if (typeof j === 'object' && j !== null) {
      const o = j as Record<string, unknown>;
      for (const key of ['sessions', 'chats', 'items', 'data'] as const) {
        const arr = o[key];
        if (Array.isArray(arr)) {
          for (const item of arr) {
            const e = normalizeEntry(item);
            if (e) {
              rows.push(e);
            }
          }
          break;
        }
      }
      if (rows.length === 0) {
        const e = normalizeEntry(j);
        if (e) {
          rows.push(e);
        }
      }
    }
    if (rows.length > 0) {
      return rows.slice(0, limit);
    }
  } catch {
    /* fall through */
  }

  const text = stripAnsi(stdout);
  const seen = new Set<string>();
  const out: SessionListEntry[] = [];
  let m: RegExpExecArray | null;
  const uuidLine = new RegExp(UUID_RE.source, 'g');
  while ((m = uuidLine.exec(text)) !== null) {
    const id = m[0];
    if (!seen.has(id)) {
      seen.add(id);
      out.push({ id, createdAt: '' });
      if (out.length >= limit) {
        break;
      }
    }
  }
  return out;
}

export function createSessionListDescriptor(
  _ctx: PipelineContext,
): ToolDescriptor<SessionListParsed> {
  return {
    name: 'session_list',
    description:
      'List prior Cursor agent chat sessions (runs `agent ls`). Parsed output format may vary by CLI version.',
    schema: sessionListSchema as z.ZodType<SessionListParsed>,
    pathArgs: () => [],
    handler: async (
      input: SessionListParsed,
      executor: IAgentExecutor,
      toolCtx: PipelineContext,
    ) => {
      const result = await executor.run({
        binary: toolCtx.agentBinaryPath,
        args: buildSessionListArgs(),
        timeoutMs: toolCtx.agentTimeoutMs,
        maxOutputBytes: toolCtx.maxOutputBytes,
      });
      if (result.timedOut || result.exitCode !== 0) {
        const r: ExecutorResult = result;
        return r;
      }
      const sessions = parseSessionListStdout(result.stdout, input.limit);
      return { sessions };
    },
  };
}
