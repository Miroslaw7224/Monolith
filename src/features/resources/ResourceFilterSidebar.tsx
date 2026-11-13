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
    <div className="space-y-3">
      <p className="text-sm font-medium text-[var(--text)]">{filterByTagsLabel}</p>
      <div className="flex flex-wrap gap-1.5">
        {allTags.map((tag) => (
          <button
            key={tag}
            type="button"
            onClick={() => toggleTag(tag)}
            className={`px-2.5 py-1 rounded-lg text-sm font-medium transition-colors ${
              selectedTags.includes(tag)
                ? "bg-[var(--accent)] text-white"
                : "bg-[var(--bg3)] text-[var(--text)] hover:bg-[var(--border)]"
            }`}
          >
            {tag}
          </button>
        ))}
      </div>
      {selectedTags.length > 0 && (
        <button
          type="button"
          onClick={clearTagFilter}
          className="text-sm text-[var(--text2)] hover:text-[var(--text)] font-medium"
        >
          {clearFiltersLabel}
        </button>
      )}
    </div>
  );
}
