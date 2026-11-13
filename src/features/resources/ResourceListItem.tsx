import React from "react";
import Image from "next/image";
import { Copy, Trash2, Star, Pencil } from "lucide-react";
import type { NoteResource } from "./resourceTypes";
import { getFaviconUrl } from "./resourceParsing";

export interface ResourceListItemProps {
  resource: NoteResource;
  titleUnavailableLabel: string;
  resourceFavoriteLabel: string;
  resourceEditLabel: string;
  onOpenEdit: (r: NoteResource) => void;
  onToggleFavorite: (r: NoteResource) => void;
  onCopy: (url: string) => void;
  onDelete: (id: string) => void;
}

export function ResourceListItem({
  resource: r,
  titleUnavailableLabel,
  resourceFavoriteLabel,
  resourceEditLabel,
  onOpenEdit,
  onToggleFavorite,
  onCopy,
  onDelete,
}: ResourceListItemProps) {
  const favicon = getFaviconUrl(r.url);
  const [showFavicon, setShowFavicon] = React.useState(true);

  return (
    <li className="ars-res-item">
      <div
        className="ars-res-main"
        onClick={() => onOpenEdit(r)}
        onKeyDown={(e) => e.key === "Enter" && onOpenEdit(r)}
        role="button"
        tabIndex={0}
      >
        {favicon && showFavicon && (
          <div className="ars-res-favicon">
            <Image
              src={favicon}
              width={28}
              height={28}
              className="ars-res-favicon__img"
              style={{ borderRadius: "4px", width: 28, height: 28 }}
              alt=""
              unoptimized
              onError={() => setShowFavicon(false)}
            />
          </div>
        )}
        <div className="ars-res-content">
          <div className="ars-res-title">
            {r.title === r.url ? (
              <span className="ars-res-title-raw">
                <span>{r.url}</span>
                <span className="ars-res-unavailable ml-1">{titleUnavailableLabel}</span>
              </span>
            ) : (
              <span className="ars-res-title-text">{r.title}</span>
            )}
          </div>
          <p className="ars-res-desc">{r.description}</p>
          <div className="ars-res-meta">
            {(r.tags || []).map((tag) => (
              <span key={tag} className="chip ars-res-tag">
                <span className="ars-hash" aria-hidden="true">
                  #
                </span>
                {tag}
              </span>
            ))}
          </div>
        </div>
      </div>
      <div className="ars-res-actions">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onToggleFavorite(r);
          }}
          className={`btn btn--sm btn--icon ars-action-btn ${
            r.isFavorite ? "ars-btn--fav-active" : "btn--ghost"
          }`}
          title={resourceFavoriteLabel}
          aria-label={resourceFavoriteLabel}
          aria-pressed={r.isFavorite}
        >
          <Star className={`w-4 h-4 ${r.isFavorite ? "fill-current" : ""}`} />
        </button>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onOpenEdit(r);
          }}
          className="btn btn--sm btn--icon btn--ghost ars-action-btn"
          title={resourceEditLabel}
          aria-label={resourceEditLabel}
        >
          <Pencil className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onCopy(r.url);
          }}
          className="btn btn--sm btn--icon btn--ghost ars-action-btn"
          title="Copy URL"
          aria-label="Copy URL"
        >
          <Copy className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onDelete(r.id);
          }}
          className="btn btn--sm btn--icon btn--ghost ars-action-btn ars-btn--danger"
          title="Delete"
          aria-label="Delete"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    </li>
  );
}
