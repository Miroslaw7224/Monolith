import React from "react";
import { Loader2 } from "lucide-react";
import type { ResourceSectionProps, NoteResource } from "./resourceTypes";
import { useResources } from "./useResources";
import { ResourceFilterSidebar } from "./ResourceFilterSidebar";
import { ResourceAddForm } from "./ResourceAddForm";
import { ResourceFavoritesBar } from "./ResourceFavoritesBar";
import { ResourceListItem } from "./ResourceListItem";
import { ResourceEditModal } from "./ResourceEditModal";

export type { NoteResource } from "./resourceTypes";

export function ResourceSection({ apiFetch, t }: ResourceSectionProps) {
  const {
    resources,
    loading,
    searchQuery,
    setSearchQuery,
    allTags,
    selectedTags,
    toggleTag,
    clearTagFilter,
    filteredResources,
    labels,
    addDescription,
    setAddDescription,
    addUrl,
    setAddUrl,
    addTags,
    setAddTags,
    adding,
    formExpanded,
    setFormExpanded,
    handleAdd,
    blockFormatText,
    setBlockFormatText,
    blockFormatError,
    setBlockFormatError,
    blockFormatExpanded,
    setBlockFormatExpanded,
    handleAddFromBlock,
    copyMessage,
    handleCopy,
    handleDelete,
    openEditModal,
    handleToggleFavorite,
    editingResource,
    editForm,
    setEditForm,
    closeEditModal,
    handleSaveEdit,
  } = useResources(apiFetch, t);

  const favorites = resources.filter((r) => r.isFavorite === true);

  return (
    <div style={{ display: "contents" }}>
      <div className="p-6 border-b border-[var(--border)] bg-[var(--surface)] flex items-center justify-between gap-4">
        <h2 className="text-lg font-bold">{labels.tabResources}</h2>
        <input
          type="search"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder={labels.resourceSearchPlaceholder}
          className="flex-1 max-w-xs px-4 py-2 bg-[var(--bg3)] border border-[var(--border)] rounded-xl text-sm focus:ring-2 focus:ring-[var(--accent)] focus:border-transparent outline-none"
          aria-label={labels.resourceSearchPlaceholder}
        />
      </div>
      <div className="flex-1 overflow-auto p-6 flex gap-6 min-h-0">
        <div className="flex-[1_1_0%] min-w-0 space-y-6 overflow-auto pr-2">
          {!loading && resources.length > 0 && (
            <ResourceFilterSidebar
              allTags={allTags}
              selectedTags={selectedTags}
              toggleTag={toggleTag}
              clearTagFilter={clearTagFilter}
              loading={loading}
              resourcesLength={resources.length}
              filterByTagsLabel={labels.resourceFilterByTags}
              clearFiltersLabel={labels.resourceClearFilters}
            />
          )}
          <ResourceAddForm
            resourceDescriptionPlaceholder={labels.resourceDescriptionPlaceholder}
            resourceUrlPlaceholder={labels.resourceUrlPlaceholder}
            resourceTagsPlaceholder={labels.resourceTagsPlaceholder}
            addResourceLabel={labels.addResource}
            blockFormatLabel={labels.resourceBlockFormatLabel}
            blockFormatPlaceholder={labels.resourceBlockFormatPlaceholder}
            blockFormatHint={labels.resourceBlockFormatHint}
            addFromBlockLabel={labels.resourceAddFromBlock}
            addDescription={addDescription}
            setAddDescription={setAddDescription}
            addUrl={addUrl}
            setAddUrl={setAddUrl}
            addTags={addTags}
            setAddTags={setAddTags}
            adding={adding}
            formExpanded={formExpanded}
            setFormExpanded={setFormExpanded}
            handleAdd={handleAdd}
            blockFormatText={blockFormatText}
            setBlockFormatText={setBlockFormatText}
            setBlockFormatError={setBlockFormatError}
            blockFormatExpanded={blockFormatExpanded}
            setBlockFormatExpanded={setBlockFormatExpanded}
            handleAddFromBlock={handleAddFromBlock}
            blockFormatError={blockFormatError}
            copyMessage={copyMessage}
          />
        </div>

        <div
          className={
            !loading && resources.length > 0
              ? "flex-[2_2_0%] min-w-0 space-y-3 overflow-auto"
              : "flex-1 min-w-0 space-y-3 overflow-auto"
          }
        >
          <ResourceFavoritesBar
            favorites={favorites}
            sectionTitle={labels.resourceFavoritesSectionTitle}
          />
          <div className="border-t border-[var(--border)] pt-4">
            {loading ? (
              <div className="flex items-center gap-2 text-[var(--text3)]">
                <Loader2 className="w-5 h-5 animate-spin" />
                <span>Loading...</span>
              </div>
            ) : resources.length === 0 ? (
              <p className="text-[var(--text3)] font-medium">{labels.resourceNoResources}</p>
            ) : filteredResources.length === 0 ? (
              <p className="text-[var(--text3)] font-medium">{labels.resourceNoMatchingTags}</p>
            ) : (
              <ul className="space-y-1.5">
                {filteredResources.map((r) => (
                  <ResourceListItem
                    key={r.id}
                    resource={r}
                    titleUnavailableLabel={labels.resourceTitleUnavailable}
                    resourceFavoriteLabel={labels.resourceFavorite}
                    resourceEditLabel={labels.resourceEdit}
                    onOpenEdit={openEditModal}
                    onToggleFavorite={handleToggleFavorite}
                    onCopy={handleCopy}
                    onDelete={handleDelete}
                  />
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>

      <ResourceEditModal
        isOpen={editingResource != null}
        titleLabel={labels.resourceEditModalTitle}
        resourceDescriptionPlaceholder={labels.resourceDescriptionPlaceholder}
        resourceUrlPlaceholder={labels.resourceUrlPlaceholder}
        resourceTagsPlaceholder={labels.resourceTagsPlaceholder}
        resourceFavoriteLabel={labels.resourceFavorite}
        cancelLabel={labels.noteCancelEdit}
        saveLabel={labels.resourceSaveEdit}
        editForm={editForm}
        setEditForm={setEditForm}
        onClose={closeEditModal}
        onSave={handleSaveEdit}
      />
    </div>
  );
}
