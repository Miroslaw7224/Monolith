import React from "react";

export interface ResourceFilterSidebarProps {
  allTags: string[];
  selectedTags: string[];
  toggleTag: (tag: string) => void;
  clearTagFilter: () => void;
  loading: boolean;
  resourcesLength: number;
  filterByTagsLabel: string;
  clearFiltersLabel: string;
}

export function ResourceFilterSidebar({
  allTags,
  selectedTags,
  toggleTag,
  clearTagFilter,
  loading,
  resourcesLength,
  filterByTagsLabel,
  clearFiltersLabel,
}: ResourceFilterSidebarProps) {
  if (loading || resourcesLength === 0) return null;

  return (
    <div className="ars-filter-box">
      <div className="ars-filter-box__head">
        <span className="ars-filter-box__label">{filterByTagsLabel}</span>
        {selectedTags.length > 0 && (
          <button type="button" onClick={clearTagFilter} className="ars-filter-box__clear">
            {clearFiltersLabel}
          </button>
        )}
      </div>
      <div className="ars-filter-chips">
        {allTags.map((tag) => {
          const isSelected = selectedTags.includes(tag);
          return (
            <button
              key={tag}
              type="button"
              onClick={() => toggleTag(tag)}
              className={`chip ${isSelected ? "chip--accent" : ""}`}
              aria-pressed={isSelected}
            >
              <span className="ars-hash" aria-hidden="true">
                #
              </span>
              {tag}
            </button>
          );
        })}
      </div>
    </div>
  );
}
