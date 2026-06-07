export interface Workspace {
  id: string;
  name: string;
}

export interface PageObject {
  id: string;
  workspace: string;
  name: string;
  url: string;
}

export interface PageElement {
  id: string;
  name: string;
  pageObject: string;
  selector: string;
}

export interface PageObjectNavigation {
  id: string;
  name: string;
  pageObject: string;
  pageElementIdsNavigation: string[];
}

export interface DbShape {
  workspaces: Record<string, Workspace>;
  pageObjects: Record<string, PageObject>;
  pageElements: Record<string, PageElement>;
  pageObjectNavigations: Record<string, PageObjectNavigation>;
}

export const EMPTY_DB: DbShape = {
  workspaces: {},
  pageObjects: {},
  pageElements: {},
  pageObjectNavigations: {},
};
