# page-object-mcp

An MCP (Model Context Protocol) server for managing page objects, elements, and navigation sequences. Gives AI agents a structured registry for browser automation — store selectors once, reuse everywhere.

## Quick Start

```bash
npx page-object-mcp
```

Add to your MCP client config:

```json
{
  "mcpServers": {
    "page-object-mcp": {
      "command": "npx",
      "args": ["page-object-mcp"]
    }
  }
}
```

## Concept

Think of this as a phone book for your UI. Instead of an AI agent rediscovering selectors every session, you define them once and reference them by name.

```
Workspace
└── PageObject  (one per page/route, e.g. "Login Page" → /login)
    ├── PageElement  (one selector step, e.g. "Login Form" → [data-testid="main-form"])
    └── PageObjectNavigation  (DOM traversal path to a specific element,
                               e.g. "Login Input" → [form, fieldset, input#login])
```

A `PageObjectNavigation` is an ordered chain of `PageElement` selectors that traverses the DOM hierarchy to locate a specific element — from outermost container down to the target. Each entry narrows the scope.

A call to `get_navigation` returns the page URL and that ordered selector chain.

## Entities

| Entity | Fields |
|--------|--------|
| **Workspace** | `id`, `name` |
| **PageObject** | `id`, `workspace`, `name`, `url` |
| **PageElement** | `id`, `pageObject`, `name`, `selector` |
| **PageObjectNavigation** | `id`, `pageObject`, `name`, `pageElementIdsNavigation` (array of PageElement IDs) |

> **`get_page_object_navigation` returns resolved fields** — instead of raw UUIDs, it returns `pageObjectUrl` (the URL string from the parent PageObject) and `pageElementsNavigation` (ordered array of selector strings). Use `create_page_object_navigation` / `update_page_object_navigation` with the raw `pageElementIdsNavigation` IDs as usual.

**URL patterns** — `PageObject.url` can be an Express-style pattern like `/user/:id`. Use `get_navigation_required_params` to discover which params are needed, then pass them to `get_navigation` to get a resolved URL.

**Navigation scope** — A `PageObjectNavigation` is scoped to a single `PageObject`. For multi-page flows, create one navigation per page and compose them in your agent.

## Tools

### Workspace

| Tool | Description |
|------|-------------|
| `create_workspace` | Create a workspace |
| `get_workspace` | Get by ID |
| `list_workspaces` | List all workspaces |
| `update_workspace` | Rename |
| `delete_workspace` | Delete and cascade to all contents |

### PageObject

| Tool | Description |
|------|-------------|
| `create_page_object` | Create a page object in a workspace |
| `get_page_object` | Get by ID |
| `list_page_objects` | List by workspace ID |
| `update_page_object` | Update name, url, or workspace |
| `delete_page_object` | Delete and cascade to elements/navigations |

### PageElement

| Tool | Description |
|------|-------------|
| `create_page_element` | Create an element with a CSS/XPath selector |
| `get_page_element` | Get by ID |
| `list_page_elements` | List by page object ID |
| `update_page_element` | Update name, selector, or parent |
| `delete_page_element` | Delete element |

### PageObjectNavigation

| Tool | Description |
|------|-------------|
| `create_page_object_navigation` | Create a DOM traversal path (ordered chain of elements) |
| `get_page_object_navigation` | Get by ID — returns `{ id, name, pageObjectUrl, pageElementsNavigation }` with resolved URL and selectors |
| `list_page_object_navigations` | List by page object ID (returns raw stored data) |
| `update_page_object_navigation` | Update name, sequence, or parent |
| `delete_page_object_navigation` | Delete navigation |

### Navigation Resolution

| Tool | Input | Output |
|------|-------|--------|
| `get_navigation` | `pageObjectNavigationId`, `urlParams?` | `{ urlPattern, resolvedUrl?, selector }` |
| `get_navigation_required_params` | `pageObjectNavigationId` | `{ params: string[] }` |

`selector` is the space-joined CSS selector built from `pageElementIdsNavigation` (outermost → target), e.g. `[data-testid="main-form"] #login input`.

### Search

```
search(workspaceId, query, type?)
```

Searches `name` fields across `pageObject`, `pageElement`, and `pageObjectNavigation` (or one type if specified). `query` is treated as a case-insensitive regexp.

Returns:
```json
{
  "results": [
    { "type": "pageElement", "id": "...", "name": "Submit Button" }
  ]
}
```

## Example Workflow

```
1. create_workspace         → { id: "ws-1", name: "My App" }
2. create_page_object       → { id: "po-1", workspace: "ws-1", name: "Login", url: "/login" }
3. create_page_element      → { id: "el-1", pageObject: "po-1", name: "Main Form",    selector: "[data-testid=\"main-form\"]" }
4. create_page_element      → { id: "el-2", pageObject: "po-1", name: "Login Group",  selector: "#login" }
5. create_page_element      → { id: "el-3", pageObject: "po-1", name: "Login Input",  selector: "input" }
6. create_page_object_navigation → {
     id: "nav-1", pageObject: "po-1",
     name: "Login Input Path",
     pageElementIdsNavigation: ["el-1", "el-2", "el-3"]  // outermost → target
   }

7. get_page_object_navigation({ id: "nav-1" })
   → {
       id: "nav-1",
       name: "Login Input Path",
       pageObjectUrl: "/login",
       pageElementsNavigation: ["[data-testid=\"main-form\"]", "#login", "input"]
     }

8. get_navigation({ pageObjectNavigationId: "nav-1" })
   → {
       urlPattern: "/login",
       selector: "[data-testid=\"main-form\"] #login input"
     }
```

## Data Storage

Data is stored as JSON at:

```
~/.page-object-mcp/db.json
```

Override with the `PAGE_OBJECT_MCP_DB` environment variable:

```bash
PAGE_OBJECT_MCP_DB=/my/custom/path npx page-object-mcp
```

## Validation

All foreign key references are validated on write. If an agent passes a non-existent ID, the tool returns `isError: true` with a descriptive message — so agents can self-correct without silent data corruption.

**Cascade delete** — deleting a parent cascades to all children:
- Delete `Workspace` → deletes its `PageObjects` → deletes their `PageElements` and `PageObjectNavigations`
- Delete `PageObject` → deletes its `PageElements` and `PageObjectNavigations`

## Development

```bash
npm install
npm run build   # tsc → dist/
npm test        # vitest (32 tests)
npm run dev     # tsc --watch
```

**Requirements:** Node.js ≥ 18
