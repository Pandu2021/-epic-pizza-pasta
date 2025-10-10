const stripTrailingSlash = (value: string) => value.replace(/\/$/, '');

export function getApiBaseUrl(): string {
  const explicit = process.env.API_BASE_URL || process.env.PUBLIC_API_URL || process.env.BACKEND_PUBLIC_URL;
  if (explicit) {
    return stripTrailingSlash(explicit.trim());
  }
  const appOrigin = process.env.APP_ORIGIN || process.env.DOMAIN || '';
  if (appOrigin) {
    return `${stripTrailingSlash(appOrigin.trim())}/api`;
  }
  const port = process.env.PORT || '4000';
  return `http://localhost:${port}/api`;
}

export function buildApiUrl(path: string): string {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${getApiBaseUrl()}${normalizedPath}`;
}
