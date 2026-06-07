import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { Store } from '../store.js';

function ok(data: unknown) {
  return { content: [{ type: 'text' as const, text: JSON.stringify(data) }] };
}

function err(msg: string) {
  return { isError: true as const, content: [{ type: 'text' as const, text: msg }] };
}

export function registerSearchTools(server: McpServer, store: Store): void {
  server.registerTool(
    'search',
    {
      description:
        'Search by name across PageObjects, PageElements, and PageObjectNavigations within a workspace. query supports regexp.',
      inputSchema: {
        workspaceId: z.string(),
        query: z.string(),
        type: z.enum(['pageObject', 'pageElement', 'pageObjectNavigation']).optional(),
      },
    },
    async ({ workspaceId, query, type }) => {
      let re: RegExp;
      try {
        re = new RegExp(query, 'i');
      } catch {
        return err(`Invalid regexp: ${query}`);
      }

      const results: Array<{ type: string; id: string; name: string }> = [];

      if (!type || type === 'pageObject') {
        for (const o of store.listPageObjects(workspaceId).filter(o => re.test(o.name))) {
          results.push({ type: 'pageObject', id: o.id, name: o.name });
        }
      }

      if (!type || type === 'pageElement') {
        const poIds = new Set(store.listPageObjects(workspaceId).map(po => po.id));
        for (const el of store
          .getAllPageElements()
          .filter(el => poIds.has(el.pageObject) && re.test(el.name))) {
          results.push({ type: 'pageElement', id: el.id, name: el.name });
        }
      }

      if (!type || type === 'pageObjectNavigation') {
        const poIds = new Set(store.listPageObjects(workspaceId).map(po => po.id));
        for (const nav of store
          .getAllPageObjectNavigations()
          .filter(nav => poIds.has(nav.pageObject) && re.test(nav.name))) {
          results.push({ type: 'pageObjectNavigation', id: nav.id, name: nav.name });
        }
      }

      return ok({ results });
    },
  );
}
