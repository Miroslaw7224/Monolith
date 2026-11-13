import React from "react";
import Image from "next/image";
import type { NoteResource } from "./resourceTypes";
import { getFaviconUrl } from "./resourceParsing";

export interface ResourceFavoritesBarProps {
  favorites: NoteResource[];
  sectionTitle: string;
}

function FavoriteResourceButton({ resource }: { resource: NoteResource }) {
  const favicon = getFaviconUrl(resource.url);
  const [showFavicon, setShowFavicon] = React.useState(true);

  return (
    <button
      type="button"
      onClick={() => window.open(resource.url, "_blank")}
      className="w-16 h-16 flex items-center justify-center rounded-lg hover:bg-[var(--bg3)] transition-colors"
    >
      {favicon && showFavicon && (
        <Image
          src={favicon}
          width={48}
          height={48}
          className="object-contain"
          style={{ borderRadius: "6px", width: 48, height: 48 }}
          alt=""
          unoptimized
          onError={() => setShowFavicon(false)}
        />
      )}
    </button>
  );
}

export function ResourceFavoritesBar({ favorites, sectionTitle }: ResourceFavoritesBarProps) {
  if (favorites.length === 0) return null;

  return (
    <div className="space-y-2">
      <p className="text-sm font-medium text-[var(--text)]">{sectionTitle}</p>
      <div className="flex flex-wrap gap-4">
        {favorites.map((r) => (
          <FavoriteResourceButton key={r.id} resource={r} />
        ))}
      </div>
    </div>
  );
}
