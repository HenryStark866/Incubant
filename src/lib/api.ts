/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Utility to manage the API URL across different environments.
 * In production (Vercel), it should point to the Render backend.
 * In development, it points to local server or empty for relative proxy.
 */

const IS_PROD = import.meta.env.PROD;
const VITE_API_BASE_URL = import.meta.env.VITE_API_URL || '';

export const API_BASE_URL = IS_PROD 
  ? (import.meta.env.VITE_API_URL || 'https://incubant.onrender.com') 
  : '';

/**
 * Normalizes a URL ensuring it uses the API_BASE_URL if needed.
 */
export function getApiUrl(path: string): string {
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  // If API_BASE_URL is empty, it means we are using relative paths (usual for local vite proxy)
  if (!API_BASE_URL) return cleanPath;
  return `${API_BASE_URL}${cleanPath}`;
}
