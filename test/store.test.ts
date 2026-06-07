import { rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { FkError, NotFoundError, Store } from '../src/store.js';

let testDir: string;

beforeEach(() => {
  testDir = join(tmpdir(), `pom-test-${crypto.randomUUID()}`);
  process.env.PAGE_OBJECT_MCP_DB = testDir;
});

afterEach(async () => {
  delete process.env.PAGE_OBJECT_MCP_DB;
  await rm(testDir, { recursive: true, force: true });
});

describe('Workspace CRUD', () => {
  it('creates and retrieves', async () => {
    const store = await Store.create();
    const ws = await store.createWorkspace('My Workspace');
    expect(ws.name).toBe('My Workspace');
    expect(ws.id).toBeTruthy();
    expect(store.getWorkspace(ws.id)).toEqual(ws);
  });

  it('lists workspaces', async () => {
    const store = await Store.create();
    await store.createWorkspace('A');
    await store.createWorkspace('B');
    expect(store.listWorkspaces()).toHaveLength(2);
  });

  it('updates name', async () => {
    const store = await Store.create();
    const ws = await store.createWorkspace('Old');
    await store.updateWorkspace(ws.id, { name: 'New' });
    expect(store.getWorkspace(ws.id)?.name).toBe('New');
  });

  it('throws NotFoundError on update of missing id', async () => {
    const store = await Store.create();
    await expect(store.updateWorkspace('nope', { name: 'x' })).rejects.toThrow(NotFoundError);
  });

  it('deletes and cascades to PageObjects, PageElements, and Navigations', async () => {
    const store = await Store.create();
    const ws = await store.createWorkspace('W');
    const po = await store.createPageObject({ workspace: ws.id, name: 'P', url: '/p' });
    const el = await store.createPageElement({ pageObject: po.id, name: 'E', selector: '.e' });
    await store.createPageObjectNavigation({
      pageObject: po.id,
      name: 'Nav',
      pageElementIdsNavigation: [el.id],
    });
    await store.deleteWorkspace(ws.id);
    expect(store.getWorkspace(ws.id)).toBeUndefined();
    expect(store.listPageObjects(ws.id)).toHaveLength(0);
    expect(store.listPageElements(po.id)).toHaveLength(0);
    expect(store.listPageObjectNavigations(po.id)).toHaveLength(0);
  });
});

describe('PageObject CRUD', () => {
  it('creates with FK check', async () => {
    const store = await Store.create();
    const ws = await store.createWorkspace('W');
    const po = await store.createPageObject({ workspace: ws.id, name: 'Login', url: '/login' });
    expect(po.workspace).toBe(ws.id);
  });

  it('lists by workspace', async () => {
    const store = await Store.create();
    const ws = await store.createWorkspace('W');
    await store.createPageObject({ workspace: ws.id, name: 'A', url: '/a' });
    await store.createPageObject({ workspace: ws.id, name: 'B', url: '/b' });
    expect(store.listPageObjects(ws.id)).toHaveLength(2);
  });

  it('deletes and cascades to elements and navigations', async () => {
    const store = await Store.create();
    const ws = await store.createWorkspace('W');
    const po = await store.createPageObject({ workspace: ws.id, name: 'P', url: '/' });
    const el = await store.createPageElement({ pageObject: po.id, name: 'E', selector: '.e' });
    await store.createPageObjectNavigation({
      pageObject: po.id,
      name: 'N',
      pageElementIdsNavigation: [el.id],
    });
    await store.deletePageObject(po.id);
    expect(store.getPageObject(po.id)).toBeUndefined();
    expect(store.getAllPageElements().filter(e => e.pageObject === po.id)).toHaveLength(0);
    expect(store.getAllPageObjectNavigations().filter(n => n.pageObject === po.id)).toHaveLength(0);
  });
});

describe('FK validation', () => {
  it('rejects PageObject with missing workspace', async () => {
    const store = await Store.create();
    await expect(
      store.createPageObject({ workspace: 'bad-id', name: 'P', url: '/' }),
    ).rejects.toThrow(FkError);
  });

  it('rejects PageElement with missing pageObject', async () => {
    const store = await Store.create();
    await expect(
      store.createPageElement({ pageObject: 'bad-id', name: 'E', selector: '.e' }),
    ).rejects.toThrow(FkError);
  });

  it('rejects navigation with element from different pageObject', async () => {
    const store = await Store.create();
    const ws = await store.createWorkspace('W');
    const po1 = await store.createPageObject({ workspace: ws.id, name: 'P1', url: '/1' });
    const po2 = await store.createPageObject({ workspace: ws.id, name: 'P2', url: '/2' });
    const el = await store.createPageElement({ pageObject: po2.id, name: 'E', selector: '.e' });
    await expect(
      store.createPageObjectNavigation({
        pageObject: po1.id,
        name: 'Nav',
        pageElementIdsNavigation: [el.id],
      }),
    ).rejects.toThrow(FkError);
  });

  it('rejects navigation with nonexistent element id', async () => {
    const store = await Store.create();
    const ws = await store.createWorkspace('W');
    const po = await store.createPageObject({ workspace: ws.id, name: 'P', url: '/' });
    await expect(
      store.createPageObjectNavigation({
        pageObject: po.id,
        name: 'Nav',
        pageElementIdsNavigation: ['ghost-id'],
      }),
    ).rejects.toThrow(FkError);
  });
});

describe('Persistence', () => {
  it('persists and reloads across Store instances', async () => {
    const store1 = await Store.create();
    const ws = await store1.createWorkspace('Persistent');
    const store2 = await Store.create();
    expect(store2.getWorkspace(ws.id)?.name).toBe('Persistent');
  });
});
