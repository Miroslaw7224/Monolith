import React from "react";
import { ExternalLink } from "lucide-react";
import { isHttpUrl, normalizeUrl } from "./taskInputUtils";

interface TaskDescriptionLinkProps {
  description: string;
  className?: string;
}

export function TaskDescriptionLink({ description, className }: TaskDescriptionLinkProps) {
  const trimmed = description.trim();
  if (!trimmed || !isHttpUrl(trimmed)) return null;

  const href = normalizeUrl(trimmed);

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      onClick={(e) => e.stopPropagation()}
      className={[
        "inline-flex items-center gap-1 text-xs text-sky-400 hover:text-sky-300 hover:underline max-w-full min-w-0",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      title={href}
    >
      <ExternalLink className="w-3 h-3 flex-shrink-0" aria-hidden />
      <span className="truncate">{trimmed}</span>
    </a>
  );
}
