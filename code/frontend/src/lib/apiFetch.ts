/**
 * Authenticated fetch wrapper.
 * Sends X-API-Key header from localStorage.
 * On 401: clears key and dispatches "sifter:auth-expired" event.
 */

const API_KEY_KEY = "sifter_api_key";

export class AuthError extends Error {
  constructor() {
    super("Authentication expired");
    this.name = "AuthError";
  }
}

export function getApiKey(): string | null {
  return localStorage.getItem(API_KEY_KEY);
}

export function setApiKey(key: string): void {
  localStorage.setItem(API_KEY_KEY, key);
}

export function clearApiKey(): void {
  localStorage.removeItem(API_KEY_KEY);
}

// Legacy compat shims
export const getToken = getApiKey;
export const setToken = setApiKey;
export const clearToken = clearApiKey;

export async function apiFetch(
  url: string,
  options: RequestInit = {}
): Promise<Response> {
  const apiKey = getApiKey();
  const headers = new Headers(options.headers);

  if (apiKey) {
    headers.set("X-API-Key", apiKey);
  }

  const response = await fetch(url, { ...options, headers });

  if (response.status === 401) {
    clearApiKey();
    window.dispatchEvent(new CustomEvent("sifter:auth-expired"));
    throw new AuthError();
  }

  return response;
}

export async function apiFetchJson<T = unknown>(
  url: string,
  options: RequestInit = {}
): Promise<T> {
  const response = await apiFetch(url, options);
  if (!response.ok) {
    const text = await response.text();
    let detail = text;
    try {
      const json = JSON.parse(text);
      detail = json.detail || json.message || text;
    } catch {}
    throw new Error(detail || `Request failed: ${response.status}`);
  }
  return response.json() as Promise<T>;
}
