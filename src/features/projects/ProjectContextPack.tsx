import React, { useEffect, useRef, useState } from "react";
import type { ContextPackDto } from "@/contexts/bc_projects/schemas";
import type { ContextPackResult } from "./mutation";

const tokensLabel = (approxTokens: number) =>
  `~${(approxTokens / 1000).toFixed(1).replace(".", ",")} tys. tokenów`;

/** Przycisk „Kopiuj paczkę kontekstu”: pobiera paczkę z serwera, kopiuje do schowka i pokazuje wynik. */
export function ProjectContextPack(props: {
  onLoad: () => Promise<ContextPackResult>;
}): React.JSX.Element {
  const { onLoad } = props;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<ContextPackDto | null>(null);
  /** Po odmontowaniu (np. zmiana projektu w trakcie ładowania) spóźniona odpowiedź nie rusza schowka. */
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const copy = async () => {
    setBusy(true);
    setError(null);
    setCopied(null);
    const result = await onLoad();
    if (!mounted.current) return;
    if (result.ok === false) {
      setError(result.error);
      setBusy(false);
      return;
    }
    try {
      await navigator.clipboard.writeText(result.pack.markdown);
      setCopied(result.pack);
    } catch {
      setError("Nie udało się skopiować do schowka");
    }
    setBusy(false);
  };

  return (
    <div className="prj-pack">
      <button type="button" className="prj-btn" disabled={busy} onClick={copy}>
        Kopiuj paczkę kontekstu
      </button>
      {error ? (
        <p className="prj-alert" role="alert">
          {error}
        </p>
      ) : null}
      {copied ? (
        <>
          <p className="prj-pack__note" role="status">
            Skopiowano paczkę kontekstu ({tokensLabel(copied.approxTokens)})
            {copied.truncated ? " · skrócona do budżetu" : ""}
          </p>
          {copied.warnings.length > 0 ? (
            <p className="prj-pack__note" role="status">
              {copied.warnings.join(" · ")}
            </p>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
