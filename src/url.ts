export function extractUrlParams(urlPattern: string): string[] {
  return [...urlPattern.matchAll(/:([A-Za-z_][A-Za-z0-9_]*)/g)].map(m => m[1]);
}

export function resolveUrlPattern(urlPattern: string, params: Record<string, string>): string {
  return urlPattern.replace(/:([A-Za-z_][A-Za-z0-9_]*)/g, (_, key) => params[key] ?? `:${key}`);
}
