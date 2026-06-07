import { rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { Store } from '../src/store.js';
import { extractUrlParams, resolveUrlPattern } from '../src/url.js';

let testDir: string;

beforeEach(() => {
  testDir = join(tmpdir(), `nav-test-${crypto.randomUUID()}`);
  process.env.PAGE_OBJECT_MCP_DB = testDir;
});

afterEach(async () => {
  delete process.env.PAGE_OBJECT_MCP_DB;
  await rm(testDir, { recursive: true, force: true });
});

describe('extractUrlParams', () => {
  it('extracts param names', () => {
    expect(extractUrlParams('/user/:id/post/:postId')).toEqual(['id', 'postId']);
  });

  it('returns empty array for static url', () => {
    expect(extractUrlParams('/static/path')).toEqual([]);
  });

  it('handles underscore in param names', () => {
    expect(extractUrlParams('/item/:item_id')).toEqual(['item_id']);
  });
});

describe('resolveUrlPattern', () => {
  it('substitutes all params', () => {
    expect(resolveUrlPattern('/user/:id', { id: '42' })).toBe('/user/42');
  });

  it('leaves unresolved params in place', () => {
    expect(resolveUrlPattern('/user/:id/:tab', { id: '42' })).toBe('/user/42/:tab');
  });

  it('handles multiple params', () => {
    expect(resolveUrlPattern('/user/:userId/post/:postId', { userId: '1', postId: '99' })).toBe(
      '/user/1/post/99',
    );
  });
});

describe('navigation selector order', () => {
  it('preserves pageElementIdsNavigation order in selectors', async () => {
    const store = await Store.create();
    const ws = await store.createWorkspace('W');
    const po = await store.createPageObject({ workspace: ws.id, name: 'Login', url: '/login' });
    const email = await store.createPageElement({
      pageObject: po.id,
      name: 'Email',
      selector: '#email',
    });
    const password = await store.createPageElement({
      pageObject: po.id,
      name: 'Password',
      selector: '#password',
    });
    const submit = await store.createPageElement({
      pageObject: po.id,
      name: 'Submit',
      selector: '#submit',
    });

    const nav = await store.createPageObjectNavigation({
      pageObject: po.id,
      name: 'Login Flow',
      pageElementIdsNavigation: [email.id, password.id, submit.id],
    });

    const selector = nav.pageElementIdsNavigation
      .map(id => store.getPageElement(id)!.selector)
      .join(' ');
    expect(selector).toBe('#email #password #submit');
  });

  it('preserves non-sequential order', async () => {
    const store = await Store.create();
    const ws = await store.createWorkspace('W');
    const po = await store.createPageObject({ workspace: ws.id, name: 'P', url: '/' });
    const a = await store.createPageElement({ pageObject: po.id, name: 'A', selector: '.a' });
    const b = await store.createPageElement({ pageObject: po.id, name: 'B', selector: '.b' });
    const c = await store.createPageElement({ pageObject: po.id, name: 'C', selector: '.c' });

    const nav = await store.createPageObjectNavigation({
      pageObject: po.id,
      name: 'Nav',
      pageElementIdsNavigation: [c.id, a.id, b.id],
    });

    const selector = nav.pageElementIdsNavigation
      .map(id => store.getPageElement(id)!.selector)
      .join(' ');
    expect(selector).toBe('.c .a .b');
  });
});

describe('navigation with url pattern', () => {
  it('resolves url pattern for navigation', async () => {
    const store = await Store.create();
    const ws = await store.createWorkspace('W');
    const po = await store.createPageObject({
      workspace: ws.id,
      name: 'User Profile',
      url: '/user/:userId/profile',
    });
    const el = await store.createPageElement({
      pageObject: po.id,
      name: 'Edit',
      selector: '#edit-btn',
    });
    await store.createPageObjectNavigation({
      pageObject: po.id,
      name: 'Edit Profile',
      pageElementIdsNavigation: [el.id],
    });

    const params = extractUrlParams(po.url);
    expect(params).toEqual(['userId']);

    const resolved = resolveUrlPattern(po.url, { userId: '42' });
    expect(resolved).toBe('/user/42/profile');
  });
});
