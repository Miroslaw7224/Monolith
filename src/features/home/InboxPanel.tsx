// src/features/home/InboxPanel.tsx
import React, { useCallback, useEffect, useRef, useState } from "react";
import type { InboxDto } from "@/contexts/bc_inbox/schemas";

type ApiFetch = (url: string, options?: RequestInit) => Promise<Response>;

/** Szybki zapis do `Inbox/inbox.md` (Alt+I) i lista otwartych wpisów do wieczornej segregacji. */
export function InboxPanel({
  apiFetch,
  onChanged,
  focusRequest = false,
  onFocused,
}: {
  apiFetch: ApiFetch;
  /** Wołane po dodaniu albo zamknięciu wpisu, żeby Kokpit odświeżył licznik w kaflu. */
  onChanged: () => void;
  focusRequest?: boolean;
  onFocused?: () => void;
}) {
  const [inbox, setInbox] = useState<InboxDto | null>(null);
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    try {
      const res = await apiFetch("/api/inbox");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as InboxDto;
      if (Array.isArray(data.items)) setInbox(data);
    } catch {
      setError("Nie udało się wczytać inboxu");
    }
  }, [apiFetch]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!focusRequest) return;
    inputRef.current?.focus();
    onFocused?.();
  }, [focusRequest, onFocused]);

  async function call(url: string, init: RequestInit) {
    setBusy(true);
    setError(null);
    try {
      const res = await apiFetch(url, init);
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }
      await load();
      onChanged();
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Nie udało się zapisać");
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function add(e: React.FormEvent) {
    e.preventDefault();
    const value = text.trim();
    if (value === "") return;
    const ok = await call("/api/inbox", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: value }),
    });
    if (ok) setText("");
  }

  return (
    <section className="kok-panel kok-inbox" aria-label="Inbox">
      <div className="kok-panel__head">
        <h3 className="kok-panel__title">
          <b>Inbox</b>
        </h3>
        <kbd className="kok-kbd">Alt+I</kbd>
      </div>
      <form className="kok-capture" onSubmit={add}>
        <input
          ref={inputRef}
          className="kok-input"
          placeholder="Myśl, link, snippet albo bug…"
          aria-label="Szybki zapis"
          value={text}
          maxLength={500}
          onChange={(e) => setText(e.target.value)}
        />
        <button
          type="submit"
          className="kok-btn kok-btn--primary"
          disabled={busy || text.trim() === ""}
        >
          Dodaj
        </button>
      </form>
      {error ? <p className="kok-state kok-state--error">{error}</p> : null}
      {inbox && inbox.items.length === 0 ? <p className="kok-empty-msg">Inbox jest pusty</p> : null}
      <ul className="kok-inbox__list">
        {inbox?.items.map((item) => (
          <li key={item.id} className="kok-inbox__item">
            <span className="kok-inbox__type">{item.type}</span>
            <span className="kok-inbox__text">{item.text}</span>
            <button
              type="button"
              className="kok-btn kok-btn--sm kok-btn--ghost"
              disabled={busy}
              onClick={() =>
                void call(`/api/inbox/${encodeURIComponent(item.id)}`, { method: "PATCH" })
              }
            >
              Gotowe
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
