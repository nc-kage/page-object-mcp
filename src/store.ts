import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { Mutex } from 'async-mutex';
import type { DbShape, PageElement, PageObject, PageObjectNavigation, Workspace } from './types.js';
import { EMPTY_DB } from './types.js';

export class FkError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'FkError';
  }
}

export class NotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'NotFoundError';
  }
}

export class Store {
  readonly #db: DbShape;
  readonly #path: string;
  readonly #mutex = new Mutex();

  private constructor(db: DbShape, dbPath: string) {
    this.#db = db;
    this.#path = dbPath;
  }

  static dbPath(): string {
    const dir = process.env.PAGE_OBJECT_MCP_DB ?? path.join(os.homedir(), '.page-object-mcp');
    return path.join(dir, 'db.json');
  }

  static async create(): Promise<Store> {
    const dbPath = Store.dbPath();
    await fs.mkdir(path.dirname(dbPath), { recursive: true });
    let db: DbShape;
    try {
      const content = await fs.readFile(dbPath, 'utf-8');
      db = JSON.parse(content) as DbShape;
    } catch {
      db = structuredClone(EMPTY_DB);
    }
    return new Store(db, dbPath);
  }

  async #persist(): Promise<void> {
    const tmp = `${this.#path}.${crypto.randomUUID()}.tmp`;
    await fs.writeFile(tmp, JSON.stringify(this.#db, null, 2), 'utf-8');
    await fs.rename(tmp, this.#path);
  }

  // ── Workspaces ─────────────────────────────────────────────────

  async createWorkspace(name: string): Promise<Workspace> {
    return this.#mutex.runExclusive(async () => {
      const ws: Workspace = { id: crypto.randomUUID(), name };
      this.#db.workspaces[ws.id] = ws;
      await this.#persist();
      return ws;
    });
  }

  getWorkspace(id: string): Workspace | undefined {
    return this.#db.workspaces[id];
  }

  listWorkspaces(): Workspace[] {
    return Object.values(this.#db.workspaces);
  }

  async updateWorkspace(id: string, patch: Partial<Pick<Workspace, 'name'>>): Promise<Workspace> {
    return this.#mutex.runExclusive(async () => {
      const ws = this.#db.workspaces[id];
      if (!ws) throw new NotFoundError(`Workspace "${id}" not found`);
      Object.assign(ws, patch);
      await this.#persist();
      return ws;
    });
  }

  async deleteWorkspace(id: string): Promise<void> {
    return this.#mutex.runExclusive(async () => {
      if (!this.#db.workspaces[id]) throw new NotFoundError(`Workspace "${id}" not found`);
      const pageObjectIds = Object.values(this.#db.pageObjects)
        .filter(po => po.workspace === id)
        .map(po => po.id);
      for (const poId of pageObjectIds) {
        this.#cascadeDeletePageObject(poId);
      }
      delete this.#db.workspaces[id];
      await this.#persist();
    });
  }

  #cascadeDeletePageObject(pageObjectId: string): void {
    for (const [id, el] of Object.entries(this.#db.pageElements)) {
      if (el.pageObject === pageObjectId) delete this.#db.pageElements[id];
    }
    for (const [id, nav] of Object.entries(this.#db.pageObjectNavigations)) {
      if (nav.pageObject === pageObjectId) delete this.#db.pageObjectNavigations[id];
    }
    delete this.#db.pageObjects[pageObjectId];
  }

  // ── PageObjects ─────────────────────────────────────────────────

  async createPageObject(data: Omit<PageObject, 'id'>): Promise<PageObject> {
    return this.#mutex.runExclusive(async () => {
      if (!this.#db.workspaces[data.workspace])
        throw new FkError(`Workspace "${data.workspace}" not found`);
      const po: PageObject = { id: crypto.randomUUID(), ...data };
      this.#db.pageObjects[po.id] = po;
      await this.#persist();
      return po;
    });
  }

  getPageObject(id: string): PageObject | undefined {
    return this.#db.pageObjects[id];
  }

  listPageObjects(workspaceId: string): PageObject[] {
    return Object.values(this.#db.pageObjects).filter(po => po.workspace === workspaceId);
  }

  async updatePageObject(id: string, patch: Partial<Omit<PageObject, 'id'>>): Promise<PageObject> {
    return this.#mutex.runExclusive(async () => {
      const po = this.#db.pageObjects[id];
      if (!po) throw new NotFoundError(`PageObject "${id}" not found`);
      if (patch.workspace !== undefined && !this.#db.workspaces[patch.workspace])
        throw new FkError(`Workspace "${patch.workspace}" not found`);
      Object.assign(po, patch);
      await this.#persist();
      return po;
    });
  }

  async deletePageObject(id: string): Promise<void> {
    return this.#mutex.runExclusive(async () => {
      if (!this.#db.pageObjects[id]) throw new NotFoundError(`PageObject "${id}" not found`);
      this.#cascadeDeletePageObject(id);
      await this.#persist();
    });
  }

  // ── PageElements ─────────────────────────────────────────────────

  async createPageElement(data: Omit<PageElement, 'id'>): Promise<PageElement> {
    return this.#mutex.runExclusive(async () => {
      if (!this.#db.pageObjects[data.pageObject])
        throw new FkError(`PageObject "${data.pageObject}" not found`);
      const el: PageElement = { id: crypto.randomUUID(), ...data };
      this.#db.pageElements[el.id] = el;
      await this.#persist();
      return el;
    });
  }

  getPageElement(id: string): PageElement | undefined {
    return this.#db.pageElements[id];
  }

  listPageElements(pageObjectId: string): PageElement[] {
    return Object.values(this.#db.pageElements).filter(el => el.pageObject === pageObjectId);
  }

  getAllPageElements(): PageElement[] {
    return Object.values(this.#db.pageElements);
  }

  async updatePageElement(
    id: string,
    patch: Partial<Omit<PageElement, 'id'>>,
  ): Promise<PageElement> {
    return this.#mutex.runExclusive(async () => {
      const el = this.#db.pageElements[id];
      if (!el) throw new NotFoundError(`PageElement "${id}" not found`);
      if (patch.pageObject !== undefined && !this.#db.pageObjects[patch.pageObject])
        throw new FkError(`PageObject "${patch.pageObject}" not found`);
      Object.assign(el, patch);
      await this.#persist();
      return el;
    });
  }

  async deletePageElement(id: string): Promise<void> {
    return this.#mutex.runExclusive(async () => {
      if (!this.#db.pageElements[id]) throw new NotFoundError(`PageElement "${id}" not found`);
      delete this.#db.pageElements[id];
      await this.#persist();
    });
  }

  // ── PageObjectNavigations ────────────────────────────────────────

  async createPageObjectNavigation(
    data: Omit<PageObjectNavigation, 'id'>,
  ): Promise<PageObjectNavigation> {
    return this.#mutex.runExclusive(async () => {
      if (!this.#db.pageObjects[data.pageObject])
        throw new FkError(`PageObject "${data.pageObject}" not found`);
      for (const elId of data.pageElementIdsNavigation) {
        const el = this.#db.pageElements[elId];
        if (!el) throw new FkError(`PageElement "${elId}" not found`);
        if (el.pageObject !== data.pageObject)
          throw new FkError(
            `PageElement "${elId}" does not belong to PageObject "${data.pageObject}"`,
          );
      }
      const nav: PageObjectNavigation = { id: crypto.randomUUID(), ...data };
      this.#db.pageObjectNavigations[nav.id] = nav;
      await this.#persist();
      return nav;
    });
  }

  getPageObjectNavigation(id: string): PageObjectNavigation | undefined {
    return this.#db.pageObjectNavigations[id];
  }

  listPageObjectNavigations(pageObjectId: string): PageObjectNavigation[] {
    return Object.values(this.#db.pageObjectNavigations).filter(
      nav => nav.pageObject === pageObjectId,
    );
  }

  getAllPageObjectNavigations(): PageObjectNavigation[] {
    return Object.values(this.#db.pageObjectNavigations);
  }

  async updatePageObjectNavigation(
    id: string,
    patch: Partial<Omit<PageObjectNavigation, 'id'>>,
  ): Promise<PageObjectNavigation> {
    return this.#mutex.runExclusive(async () => {
      const nav = this.#db.pageObjectNavigations[id];
      if (!nav) throw new NotFoundError(`PageObjectNavigation "${id}" not found`);
      const effectivePageObject = patch.pageObject ?? nav.pageObject;
      if (patch.pageObject !== undefined && !this.#db.pageObjects[patch.pageObject])
        throw new FkError(`PageObject "${patch.pageObject}" not found`);
      if (patch.pageElementIdsNavigation !== undefined) {
        for (const elId of patch.pageElementIdsNavigation) {
          const el = this.#db.pageElements[elId];
          if (!el) throw new FkError(`PageElement "${elId}" not found`);
          if (el.pageObject !== effectivePageObject)
            throw new FkError(
              `PageElement "${elId}" does not belong to PageObject "${effectivePageObject}"`,
            );
        }
      }
      Object.assign(nav, patch);
      await this.#persist();
      return nav;
    });
  }

  async deletePageObjectNavigation(id: string): Promise<void> {
    return this.#mutex.runExclusive(async () => {
      if (!this.#db.pageObjectNavigations[id])
        throw new NotFoundError(`PageObjectNavigation "${id}" not found`);
      delete this.#db.pageObjectNavigations[id];
      await this.#persist();
    });
  }
}
