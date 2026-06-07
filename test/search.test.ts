import { rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { Store } from '../src/store.js';

let testDir: string;
let store: Store;
let workspaceId: string;
let otherWorkspaceId: string;

beforeEach(async () => {
  testDir = join(tmpdir(), `search-test-${crypto.randomUUID()}`);
  process.env.PAGE_OBJECT_MCP_DB = testDir;
  store = await Store.create();
  const ws = await store.createWorkspace('Main');
  workspaceId = ws.id;
  const other = await store.createWorkspace('Other');
  otherWorkspaceId = other.id;
});

afterEach(async () => {
  delete process.env.PAGE_OBJECT_MCP_DB;
  await rm(testDir, { recursive: true, force: true });
});

describe('PageObject search', () => {
  it('finds by substring (case-insensitive)', async () => {
    const po = await store.createPageObject({
      workspace: workspaceId,
      name: 'LoginPage',
      url: '/',
    });
    await store.createPageObject({ workspace: workspaceId, name: 'HomePage', url: '/home' });
    const re = /login/i;
    const results = store.listPageObjects(workspaceId).filter(o => re.test(o.name));
    expect(results).toHaveLength(1);
    expect(results[0].id).toBe(po.id);
  });

  it('does not return entities from other workspace', async () => {
    await store.createPageObject({ workspace: otherWorkspaceId, name: 'SecretPage', url: '/' });
    const results = store.listPageObjects(workspaceId).filter(o => /secret/i.test(o.name));
    expect(results).toHaveLength(0);
  });

  it('supports regexp', async () => {
    await store.createPageObject({ workspace: workspaceId, name: 'Page123', url: '/' });
    await store.createPageObject({ workspace: workspaceId, name: 'PageABC', url: '/abc' });
    const results = store.listPageObjects(workspaceId).filter(o => /Page\d+/.test(o.name));
    expect(results).toHaveLength(1);
    expect(results[0].name).toBe('Page123');
  });
});

describe('PageElement search scoped to workspace', () => {
  it('finds elements in workspace via pageObject chain', async () => {
    const po = await store.createPageObject({ workspace: workspaceId, name: 'P', url: '/' });
    const el = await store.createPageElement({
      pageObject: po.id,
      name: 'SubmitButton',
      selector: '#submit',
    });

    const poIds = new Set(store.listPageObjects(workspaceId).map(p => p.id));
    const results = store
      .getAllPageElements()
      .filter(e => poIds.has(e.pageObject) && /submit/i.test(e.name));
    expect(results).toHaveLength(1);
    expect(results[0].id).toBe(el.id);
  });

  it('excludes elements from other workspace', async () => {
    const otherPo = await store.createPageObject({
      workspace: otherWorkspaceId,
      name: 'P',
      url: '/',
    });
    await store.createPageElement({ pageObject: otherPo.id, name: 'SubmitButton', selector: '#s' });

    const poIds = new Set(store.listPageObjects(workspaceId).map(p => p.id));
    const results = store
      .getAllPageElements()
      .filter(e => poIds.has(e.pageObject) && /submit/i.test(e.name));
    expect(results).toHaveLength(0);
  });
});

describe('PageObjectNavigation search', () => {
  it('finds navigations by name', async () => {
    const po = await store.createPageObject({ workspace: workspaceId, name: 'P', url: '/' });
    const el = await store.createPageElement({ pageObject: po.id, name: 'E', selector: '.e' });
    const nav = await store.createPageObjectNavigation({
      pageObject: po.id,
      name: 'LoginFlow',
      pageElementIdsNavigation: [el.id],
    });

    const poIds = new Set(store.listPageObjects(workspaceId).map(p => p.id));
    const results = store
      .getAllPageObjectNavigations()
      .filter(n => poIds.has(n.pageObject) && /login/i.test(n.name));
    expect(results).toHaveLength(1);
    expect(results[0].id).toBe(nav.id);
  });
});
