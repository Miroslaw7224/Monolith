/**
 * Wywołanie API własnej aplikacji. Bez tokenu: serwer jest lokalny (0d-1),
 * a strażnik w middleware pilnuje Host i Origin.
 */
export function apiFetch(url: string, options: RequestInit = {}): Promise<Response> {
  return fetch(url, options);
}
