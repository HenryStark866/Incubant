/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Utility to manage the API URL across different environments.
 * In production (Vercel), it should point to the Render backend via rewrites.
 * In development, it points to local server or empty for relative proxy.
 */

export const API_BASE_URL = '';

/**
 * Normalizes a URL ensuring it uses the API_BASE_URL if needed.
 */
export function getApiUrl(path: string): string {
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  if (!API_BASE_URL) return cleanPath;
  return `${API_BASE_URL}${cleanPath}`;
}

/**
 * Default fetch options that include credentials (cookies) for all API calls.
 * This is REQUIRED for session cookies to work across the Vercel → Render proxy.
 */
export const apiFetch = (url: string, options: RequestInit = {}): Promise<Response> => {
  const isFormData = options.body instanceof FormData;
  const headers: Record<string, string> = {};
  if (!isFormData) {
    headers['Content-Type'] = 'application/json';
  }
  Object.assign(headers, options.headers || {});

  return fetch(url, {
    ...options,
    credentials: 'include',
    headers,
  });
};
