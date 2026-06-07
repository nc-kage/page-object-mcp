import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { Store } from '../store.js';
import { extractUrlParams, resolveUrlPattern } from '../url.js';

function ok(data: unknown) {
  return { content: [{ type: 'text' as const, text: JSON.stringify(data) }] };
}

function err(msg: string) {
  return { isError: true as const, content: [{ type: 'text' as const, text: msg }] };
}

export function registerNavigationTools(server: McpServer, store: Store): void {
  server.registerTool(
    'get_navigation',
    {
      description:
        'Resolve a navigation: returns the page URL pattern, optional resolvedUrl (if urlParams provided), and selector (space-joined DOM traversal path)',
      inputSchema: {
        pageObjectNavigationId: z.string(),
        urlParams: z.record(z.string(), z.string()).optional(),
      },
    },
    async ({ pageObjectNavigationId, urlParams }) => {
      const nav = store.getPageObjectNavigation(pageObjectNavigationId);
      if (!nav) return err(`PageObjectNavigation "${pageObjectNavigationId}" not found`);

      const po = store.getPageObject(nav.pageObject);
      if (!po) return err(`PageObject "${nav.pageObject}" not found`);

      const parts: string[] = [];
      for (const elId of nav.pageElementIdsNavigation) {
        const el = store.getPageElement(elId);
        if (!el) return err(`PageElement "${elId}" not found`);
        parts.push(el.selector);
      }

      const result: { urlPattern: string; resolvedUrl?: string; selector: string } = {
        urlPattern: po.url,
        selector: parts.join(' '),
      };

      if (urlParams !== undefined) {
        result.resolvedUrl = resolveUrlPattern(po.url, urlParams);
      }

      return ok(result);
    },
  );

  server.registerTool(
    'get_navigation_required_params',
    {
      description:
        'Returns the URL parameter names required to resolve the navigation URL pattern (e.g. /user/:id → ["id"])',
      inputSchema: { pageObjectNavigationId: z.string() },
    },
    async ({ pageObjectNavigationId }) => {
      const nav = store.getPageObjectNavigation(pageObjectNavigationId);
      if (!nav) return err(`PageObjectNavigation "${pageObjectNavigationId}" not found`);

      const po = store.getPageObject(nav.pageObject);
      if (!po) return err(`PageObject "${nav.pageObject}" not found`);

      return ok({ params: extractUrlParams(po.url) });
    },
  );
}
