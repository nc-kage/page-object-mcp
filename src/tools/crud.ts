import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { Store } from '../store.js';
import { NotFoundError } from '../store.js';

function ok(data: unknown) {
  return { content: [{ type: 'text' as const, text: JSON.stringify(data) }] };
}

function err(e: unknown) {
  const msg = e instanceof Error ? e.message : String(e);
  return { isError: true as const, content: [{ type: 'text' as const, text: msg }] };
}

export function registerCrudTools(server: McpServer, store: Store): void {
  // ── Workspaces ──────────────────────────────────────────────────

  server.registerTool(
    'create_workspace',
    { description: 'Create a new workspace', inputSchema: { name: z.string().min(1) } },
    async ({ name }) => {
      try {
        return ok(await store.createWorkspace(name));
      } catch (e) {
        return err(e);
      }
    },
  );

  server.registerTool(
    'get_workspace',
    { description: 'Get a workspace by ID', inputSchema: { id: z.string() } },
    async ({ id }) => {
      const ws = store.getWorkspace(id);
      if (!ws) return err(new NotFoundError(`Workspace "${id}" not found`));
      return ok(ws);
    },
  );

  server.registerTool('list_workspaces', { description: 'List all workspaces' }, async () =>
    ok(store.listWorkspaces()),
  );

  server.registerTool(
    'update_workspace',
    {
      description: 'Update a workspace name',
      inputSchema: { id: z.string(), name: z.string().min(1) },
    },
    async ({ id, name }) => {
      try {
        return ok(await store.updateWorkspace(id, { name }));
      } catch (e) {
        return err(e);
      }
    },
  );

  server.registerTool(
    'delete_workspace',
    {
      description: 'Delete a workspace and all its contents (page objects, elements, navigations)',
      inputSchema: { id: z.string() },
    },
    async ({ id }) => {
      try {
        await store.deleteWorkspace(id);
        return ok({ deleted: id });
      } catch (e) {
        return err(e);
      }
    },
  );

  // ── PageObjects ─────────────────────────────────────────────────

  server.registerTool(
    'create_page_object',
    {
      description:
        'Create a page object within a workspace. url may be an Express-style pattern e.g. /user/:id',
      inputSchema: { workspace: z.string(), name: z.string().min(1), url: z.string().min(1) },
    },
    async ({ workspace, name, url }) => {
      try {
        return ok(await store.createPageObject({ workspace, name, url }));
      } catch (e) {
        return err(e);
      }
    },
  );

  server.registerTool(
    'get_page_object',
    { description: 'Get a page object by ID', inputSchema: { id: z.string() } },
    async ({ id }) => {
      const po = store.getPageObject(id);
      if (!po) return err(new NotFoundError(`PageObject "${id}" not found`));
      return ok(po);
    },
  );

  server.registerTool(
    'list_page_objects',
    { description: 'List page objects in a workspace', inputSchema: { workspaceId: z.string() } },
    async ({ workspaceId }) => ok(store.listPageObjects(workspaceId)),
  );

  server.registerTool(
    'update_page_object',
    {
      description: 'Update a page object',
      inputSchema: {
        id: z.string(),
        workspace: z.string().optional(),
        name: z.string().min(1).optional(),
        url: z.string().min(1).optional(),
      },
    },
    async ({ id, workspace, name, url }) => {
      const patch: Record<string, string> = {};
      if (workspace !== undefined) patch.workspace = workspace;
      if (name !== undefined) patch.name = name;
      if (url !== undefined) patch.url = url;
      try {
        return ok(await store.updatePageObject(id, patch));
      } catch (e) {
        return err(e);
      }
    },
  );

  server.registerTool(
    'delete_page_object',
    {
      description: 'Delete a page object and its elements/navigations',
      inputSchema: { id: z.string() },
    },
    async ({ id }) => {
      try {
        await store.deletePageObject(id);
        return ok({ deleted: id });
      } catch (e) {
        return err(e);
      }
    },
  );

  // ── PageElements ─────────────────────────────────────────────────

  server.registerTool(
    'create_page_element',
    {
      description: 'Create a page element (selector) within a page object',
      inputSchema: {
        pageObject: z.string(),
        name: z.string().min(1),
        selector: z.string().min(1),
      },
    },
    async ({ pageObject, name, selector }) => {
      try {
        return ok(await store.createPageElement({ pageObject, name, selector }));
      } catch (e) {
        return err(e);
      }
    },
  );

  server.registerTool(
    'get_page_element',
    { description: 'Get a page element by ID', inputSchema: { id: z.string() } },
    async ({ id }) => {
      const el = store.getPageElement(id);
      if (!el) return err(new NotFoundError(`PageElement "${id}" not found`));
      return ok(el);
    },
  );

  server.registerTool(
    'list_page_elements',
    {
      description: 'List page elements in a page object',
      inputSchema: { pageObjectId: z.string() },
    },
    async ({ pageObjectId }) => ok(store.listPageElements(pageObjectId)),
  );

  server.registerTool(
    'update_page_element',
    {
      description: 'Update a page element',
      inputSchema: {
        id: z.string(),
        pageObject: z.string().optional(),
        name: z.string().min(1).optional(),
        selector: z.string().min(1).optional(),
      },
    },
    async ({ id, pageObject, name, selector }) => {
      const patch: Record<string, string> = {};
      if (pageObject !== undefined) patch.pageObject = pageObject;
      if (name !== undefined) patch.name = name;
      if (selector !== undefined) patch.selector = selector;
      try {
        return ok(await store.updatePageElement(id, patch));
      } catch (e) {
        return err(e);
      }
    },
  );

  server.registerTool(
    'delete_page_element',
    { description: 'Delete a page element', inputSchema: { id: z.string() } },
    async ({ id }) => {
      try {
        await store.deletePageElement(id);
        return ok({ deleted: id });
      } catch (e) {
        return err(e);
      }
    },
  );

  // ── PageObjectNavigations ────────────────────────────────────────

  server.registerTool(
    'create_page_object_navigation',
    {
      description:
        'Create an ordered navigation sequence for a page object. All pageElementIdsNavigation must belong to the specified pageObject. Scoped to a single page.',
      inputSchema: {
        pageObject: z.string(),
        name: z.string().min(1),
        pageElementIdsNavigation: z.array(z.string()),
      },
    },
    async ({ pageObject, name, pageElementIdsNavigation }) => {
      try {
        return ok(
          await store.createPageObjectNavigation({ pageObject, name, pageElementIdsNavigation }),
        );
      } catch (e) {
        return err(e);
      }
    },
  );

  server.registerTool(
    'get_page_object_navigation',
    {
      description:
        'Get a page object navigation by ID. Returns resolved values: pageObjectUrl (URL from the parent page object) and pageElementsNavigation (ordered list of selectors resolved from element IDs).',
      inputSchema: { id: z.string() },
    },
    async ({ id }) => {
      const nav = store.getPageObjectNavigation(id);
      if (!nav) return err(new NotFoundError(`PageObjectNavigation "${id}" not found`));
      const po = store.getPageObject(nav.pageObject);
      if (!po) return err(new NotFoundError(`PageObject "${nav.pageObject}" not found`));
      const selectors: string[] = [];
      for (const elId of nav.pageElementIdsNavigation) {
        const el = store.getPageElement(elId);
        if (!el) return err(new NotFoundError(`PageElement "${elId}" not found`));
        selectors.push(el.selector);
      }
      return ok({
        id: nav.id,
        name: nav.name,
        pageObjectUrl: po.url,
        pageElementsNavigation: selectors,
      });
    },
  );

  server.registerTool(
    'list_page_object_navigations',
    {
      description: 'List navigations for a page object',
      inputSchema: { pageObjectId: z.string() },
    },
    async ({ pageObjectId }) => ok(store.listPageObjectNavigations(pageObjectId)),
  );

  server.registerTool(
    'update_page_object_navigation',
    {
      description: 'Update a page object navigation',
      inputSchema: {
        id: z.string(),
        pageObject: z.string().optional(),
        name: z.string().min(1).optional(),
        pageElementIdsNavigation: z.array(z.string()).optional(),
      },
    },
    async ({ id, pageObject, name, pageElementIdsNavigation }) => {
      const patch: { pageObject?: string; name?: string; pageElementIdsNavigation?: string[] } = {};
      if (pageObject !== undefined) patch.pageObject = pageObject;
      if (name !== undefined) patch.name = name;
      if (pageElementIdsNavigation !== undefined)
        patch.pageElementIdsNavigation = pageElementIdsNavigation;
      try {
        return ok(await store.updatePageObjectNavigation(id, patch));
      } catch (e) {
        return err(e);
      }
    },
  );

  server.registerTool(
    'delete_page_object_navigation',
    { description: 'Delete a page object navigation', inputSchema: { id: z.string() } },
    async ({ id }) => {
      try {
        await store.deletePageObjectNavigation(id);
        return ok({ deleted: id });
      } catch (e) {
        return err(e);
      }
    },
  );
}
