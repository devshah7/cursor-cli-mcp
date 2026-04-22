import { describe, expect, it } from 'vitest';
import { cliPermissionsReference } from '../../../src/resources/cliPermissions.js';
import { rulesDiscovery } from '../../../src/resources/rulesDiscovery.js';

describe('MCP resources (Phase 3)', () => {
  it('cli-permissions reference meets FR-R1', () => {
    expect(cliPermissionsReference.uri).toBe('cursor-cli-mcp://resources/cli-permissions');
    expect(cliPermissionsReference.mimeType).toBe('text/markdown');
    expect(cliPermissionsReference.content.length).toBeGreaterThan(200);
    expect(cliPermissionsReference.content).toContain('Shell');
    expect(cliPermissionsReference.content).toContain('WebFetch');
    expect(cliPermissionsReference.content).toContain('Mcp');
  });

  it('rules-discovery meets FR-R2', () => {
    expect(rulesDiscovery.uri).toBe('cursor-cli-mcp://resources/rules-discovery');
    expect(rulesDiscovery.mimeType).toBe('text/markdown');
    expect(rulesDiscovery.content).toContain('.cursor/rules');
    expect(rulesDiscovery.content).toContain('AGENTS.md');
    expect(rulesDiscovery.content).toContain('CLAUDE.md');
  });
});
