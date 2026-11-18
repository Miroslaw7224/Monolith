import React from "react";
import { formatShortDate, formatTime } from "@/src/i18n/format";

type Props = {
  repo: string;
  number: number;
  title: string;
  url: string;
  /** Data ISO ostatniej zmiany PR-a. */
  updatedAt: string;
  /** Dodatkowa klasa koloru odnośnika `repo#numer` (np. `kok-reviews__ref--ready`). */
  refClassName?: string;
  /** Zawartość kolumny „status” (chip, autor, odznaka). */
  children?: React.ReactNode;
};

/** Wiersz tabelki PR: `repo#numer` + tytuł (jedna linia, wielokropek) jako link, status i data (wspólny dla „Otwarte PR” i „Do zrecenzowania”). */
export function PrRow({ repo, number, title, url, updatedAt, refClassName, children }: Props) {
  const when = new Date(updatedAt);
  return (
    <li className="kok-pr-row">
      <a
        className="kok-pr-row__main"
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        title={`${repo}#${number} ${title}`}
      >
        <span
          className={`kok-reviews__ref kok-pr-row__ref${refClassName ? ` ${refClassName}` : ""}`}
        >
          {repo}#{number}
        </span>
        <span className="kok-pr-row__title">{title}</span>
      </a>
      <span className="kok-pr-row__cell">{children}</span>
      <span className="kok-pr-row__when">
        {formatShortDate(when)} {formatTime(when)}
      </span>
    </li>
  );
}
