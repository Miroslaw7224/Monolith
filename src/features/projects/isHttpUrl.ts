/** Linkujemy tylko http(s); inny protokół (np. `javascript:`) wyświetlamy jako zwykły tekst. */
export function isHttpUrl(url: string): boolean {
  return /^https?:\/\//i.test(url);
}
