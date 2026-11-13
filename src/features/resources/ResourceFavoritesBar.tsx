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
  const title = resource.title || resource.url;

  return (
    <button
      type="button"
      onClick={() => window.open(resource.url, "_blank")}
      className="ars-fav-btn"
      title={`${title} (${resource.url})`}
      aria-label={title}
    >
      {favicon && showFavicon ? (
        <Image
          src={favicon}
          width={32}
          height={32}
          className="ars-fav-btn__icon"
          style={{ borderRadius: "4px", width: 32, height: 32, objectFit: "contain" }}
          alt=""
          unoptimized
          onError={() => setShowFavicon(false)}
        />
      ) : (
        <span className="ars-fav-btn__fallback" aria-hidden="true">
          {(resource.title || "R").charAt(0).toUpperCase()}
        </span>
      )}
      <span className="ars-fav-btn__label">{title}</span>
    </button>
  );
}

export function ResourceFavoritesBar({ favorites, sectionTitle }: ResourceFavoritesBarProps) {
  if (favorites.length === 0) return null;

  return (
    <section className="ars-favs" aria-label={sectionTitle}>
      <div className="ars-favs__head">
        <h3 className="ars-favs__title">{sectionTitle}</h3>
        <span className="chip chip--accent">{favorites.length}</span>
      </div>
      <div className="ars-favs__grid">
        {favorites.map((r) => (
          <FavoriteResourceButton key={r.id} resource={r} />
        ))}
      </div>
    </section>
  );
}
