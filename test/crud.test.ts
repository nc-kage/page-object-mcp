import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { buildServer } from '../src/server.js';

let testDir: string;
let client: Client;

async function callTool(name: string, args: Record<string, unknown>) {
  const result = await client.callTool({ name, arguments: args });
  const text = (result.content as Array<{ type: string; text: string }>)[0].text;
  return JSON.parse(text);
}

beforeEach(async () => {
  testDir = join(tmpdir(), `crud-test-${crypto.randomUUID()}`);
  process.env.PAGE_OBJECT_MCP_DB = testDir;

  const server = await buildServer();
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await server.connect(serverTransport);

  client = new Client({ name: 'test', version: '0.0.1' });
  await client.connect(clientTransport);
});

afterEach(async () => {
  await client.close();
  delete process.env.PAGE_OBJECT_MCP_DB;
  await rm(testDir, { recursive: true, force: true });
});

describe('get_page_object_navigation', () => {
  it('resolves pageObject UUID to pageObjectUrl and element UUIDs to selectors', async () => {
    const ws = await callTool('create_workspace', { name: 'W' });
    const po = await callTool('create_page_object', {
      workspace: ws.id,
      name: 'Workflow Studio',
      url: 'https://dev383139.service-now.com/now/workflow-studio/home/flow',
    });
    const el = await callTool('create_page_element', {
      pageObject: po.id,
      name: 'Flows Tab',
      selector: 'e126',
    });
    const nav = await callTool('create_page_object_navigation', {
      pageObject: po.id,
      name: 'flows_tab_button',
      pageElementIdsNavigation: [el.id],
    });

    const result = await callTool('get_page_object_navigation', { id: nav.id });

    expect(result).toEqual({
      id: nav.id,
      name: 'flows_tab_button',
      pageObjectUrl: 'https://dev383139.service-now.com/now/workflow-studio/home/flow',
      pageElementsNavigation: ['e126'],
    });
  });

  it('resolves multiple elements preserving order', async () => {
    const ws = await callTool('create_workspace', { name: 'W' });
    const po = await callTool('create_page_object', { workspace: ws.id, name: 'P', url: '/page' });
    const a = await callTool('create_page_element', { pageObject: po.id, name: 'A', selector: '#a' });
    const b = await callTool('create_page_element', { pageObject: po.id, name: 'B', selector: '#b' });
    const c = await callTool('create_page_element', { pageObject: po.id, name: 'C', selector: '#c' });
    const nav = await callTool('create_page_object_navigation', {
      pageObject: po.id,
      name: 'nav',
      pageElementIdsNavigation: [c.id, a.id, b.id],
    });

    const result = await callTool('get_page_object_navigation', { id: nav.id });

    expect(result.pageElementsNavigation).toEqual(['#c', '#a', '#b']);
    expect(result.pageObjectUrl).toBe('/page');
  });

  it('returns error for unknown id', async () => {
    const result = await client.callTool({
      name: 'get_page_object_navigation',
      arguments: { id: 'does-not-exist' },
    });
    expect(result.isError).toBe(true);
  });

  it('response omits raw pageObject and pageElementIdsNavigation fields', async () => {
    const ws = await callTool('create_workspace', { name: 'W' });
    const po = await callTool('create_page_object', { workspace: ws.id, name: 'P', url: '/p' });
    const el = await callTool('create_page_element', { pageObject: po.id, name: 'E', selector: '.e' });
    const nav = await callTool('create_page_object_navigation', {
      pageObject: po.id,
      name: 'n',
      pageElementIdsNavigation: [el.id],
    });

    const result = await callTool('get_page_object_navigation', { id: nav.id });

    expect(result).not.toHaveProperty('pageObject');
    expect(result).not.toHaveProperty('pageElementIdsNavigation');
  });
});
