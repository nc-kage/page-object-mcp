import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { Store } from './store.js';
import { registerCrudTools } from './tools/crud.js';
import { registerNavigationTools } from './tools/navigation.js';
import { registerSearchTools } from './tools/search.js';

export async function buildServer(): Promise<McpServer> {
  const store = await Store.create();
  const server = new McpServer({ name: 'page-object-mcp', version: '0.1.0' });
  registerCrudTools(server, store);
  registerNavigationTools(server, store);
  registerSearchTools(server, store);
  return server;
}
