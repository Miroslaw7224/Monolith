import React from "react";
import { ExternalLink } from "lucide-react";
import { isHttpUrl, normalizeUrl } from "./taskInputUtils";

interface TaskDescriptionLinkProps {
  link: string;
  className?: string;
}

export function TaskDescriptionLink({ link, className }: TaskDescriptionLinkProps) {
  const trimmed = link.trim();
  if (!trimmed || !isHttpUrl(trimmed)) return null;

  const href = normalizeUrl(trimmed);

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      onClick={(e) => e.stopPropagation()}
      className={["zad-desc-link", className].filter(Boolean).join(" ")}
      title={href}
    >
      <ExternalLink className="w-3 h-3 flex-shrink-0" aria-hidden />
      <span className="zad-desc-link__text">{trimmed}</span>
    </a>
  );
}
