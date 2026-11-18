import { apiFetch } from "@/src/lib/apiFetch";

/** Adres http(s) spoza tej aplikacji, który ma się otworzyć w zwykłym Chrome; inaczej `null`. */
export function externalHttpUrl(href: string, origin: string): string | null {
  let u: URL;
  try {
    u = new URL(href, origin);
  } catch {
    return null;
  }
  if (u.protocol !== "http:" && u.protocol !== "https:") return null;
  if (u.origin === origin) return null;
  return u.href;
}

/** Prosi serwer o otwarcie w Chrome; gdy się nie uda, zwykłe otwarcie karty przeglądarki. */
export async function openExternal(url: string): Promise<void> {
  try {
    const res = await apiFetch("/api/browser/open", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url }),
    });
    if (res.ok) return;
  } catch {
    // spadamy do window.open
  }
  window.open(url, "_blank", "noopener,noreferrer");
}

/** Kliknięcia `<a target="_blank">` z adresem zewnętrznym idą do Chrome (jeden handler zamiast zmian w każdym linku). */
export function interceptExternalLinks(e: MouseEvent): void {
  if (e.defaultPrevented || e.button !== 0) return;
  const target = e.target instanceof Element ? e.target : null;
  const a = target?.closest("a[target='_blank']");
  if (!(a instanceof HTMLAnchorElement)) return;
  const url = externalHttpUrl(a.getAttribute("href") ?? "", window.location.origin);
  if (url === null) return;
  e.preventDefault();
  void openExternal(url);
}
