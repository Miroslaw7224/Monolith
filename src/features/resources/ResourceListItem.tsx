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
    <li className="flex items-center justify-between gap-3 py-3 px-4 bg-[var(--surface)] border border-[var(--border)] rounded-xl">
      <div
        className="min-w-0 flex-1 flex items-stretch gap-3 cursor-pointer"
        onClick={() => onOpenEdit(r)}
        onKeyDown={(e) => e.key === "Enter" && onOpenEdit(r)}
        role="button"
        tabIndex={0}
      >
        {favicon && showFavicon && (
          <div className="flex items-center flex-shrink-0 self-stretch min-h-[2rem]">
            <Image
              src={favicon}
              width={28}
              height={28}
              className="object-contain"
              style={{ borderRadius: "4px", width: 28, height: 28 }}
              alt=""
              unoptimized
              onError={() => setShowFavicon(false)}
            />
          </div>
        )}
        <div className="min-w-0 flex-1">
          <p className="text-base font-semibold text-[var(--text)] truncate">
            {r.title === r.url ? (
              <span>
                {r.url}
                <span className="text-[var(--text3)] ml-1 font-normal text-sm">
                  {titleUnavailableLabel}
                </span>
              </span>
            ) : (
              r.title
            )}
          </p>
          <p className="text-sm text-[#6B7280] truncate mt-0.5">{r.description}</p>
          <div className="flex flex-wrap items-center gap-1.5 mt-1">
            {(r.tags || []).map((tag) => (
              <span
                key={tag}
                className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-[var(--border)] text-[var(--text)]"
              >
                {tag}
              </span>
            ))}
          </div>
        </div>
      </div>
      <div className="flex items-center gap-1 flex-shrink-0">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onToggleFavorite(r);
          }}
          className={`p-2 rounded-lg transition-colors ${
            r.isFavorite
              ? "text-amber-500 hover:bg-amber-50"
              : "text-[var(--text2)] hover:bg-[var(--bg3)] hover:text-[var(--text)]"
          }`}
          title={resourceFavoriteLabel}
        >
          <Star className={`w-4 h-4 ${r.isFavorite ? "fill-current" : ""}`} />
        </button>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onOpenEdit(r);
          }}
          className="p-2 hover:bg-[var(--bg3)] rounded-lg transition-colors text-[var(--text2)] hover:text-[var(--text)]"
          title={resourceEditLabel}
        >
          <Pencil className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onCopy(r.url);
          }}
          className="p-2 hover:bg-[var(--bg3)] rounded-lg transition-colors text-[var(--text2)] hover:text-[var(--text)]"
          title="Copy URL"
        >
          <Copy className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onDelete(r.id);
          }}
          className="p-2 hover:bg-red-50 rounded-lg transition-colors text-[#6B7280] hover:text-red-500"
          title="Delete"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    </li>
  );
}
