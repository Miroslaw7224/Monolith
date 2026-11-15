import React from "react";
import { Loader2 } from "lucide-react";
import type { ResourceSectionProps, NoteResource } from "./resourceTypes";
import { useResources } from "./useResources";
import { useT } from "@/src/i18n/useT";
import { useResourceShortcuts } from "./useResourceShortcuts";
import { ResourceFilterSidebar } from "./ResourceFilterSidebar";
import { ResourceAddForm } from "./ResourceAddForm";
import { ResourceFavoritesBar } from "./ResourceFavoritesBar";
import { ResourceListItem } from "./ResourceListItem";
import { ResourceEditModal } from "./ResourceEditModal";
import "./resources.css";

export type { NoteResource } from "./resourceTypes";

export function ResourceSection({ apiFetch, onOpenNote }: ResourceSectionProps) {
  const t = useT();
  const {
    resources,
    loading,
    searchQuery,
    setSearchQuery,
    tagCounts,
    selectedTags,
    toggleTag,
    clearTagFilter,
    clearAllFilters,
    fixOnly,
    toggleFixOnly,
    fixCount,
    dense,
    setDense,
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
  } = useResources(apiFetch);

  const searchRef = React.useRef<HTMLInputElement>(null);
  useResourceShortcuts({
    searchRef,
    onClear: clearAllFilters,
    enabled: editingResource == null,
  });

  const favorites = resources.filter((r) => r.isFavorite === true);

  return (
    <div className="ars" data-card="arsenal">
      <header className="ars-head">
        <div>
          <p className="ars-eyebrow">{t("resources:resourceEyebrow")}</p>
          <h1 className="ars-title">{labels.tabResources}</h1>
          <p className="ars-sub">{t("resources:resourceSubtitle", { count: resources.length })}</p>
        </div>
        <div className="ars-head__actions">
          <input
            ref={searchRef}
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={labels.resourceSearchPlaceholder}
            className="input ars-search"
            aria-label={labels.resourceSearchPlaceholder}
            title={t("resources:resourceSearchShortcutTitle")}
          />
          <button
            type="button"
            className={`btn btn--sm ${dense ? "chip--accent" : "btn--ghost"}`}
            aria-pressed={dense}
            onClick={() => setDense(!dense)}
          >
            {t("resources:resourceDenseButton")}
          </button>
        </div>
      </header>

      <div className="ars-layout">
        <div className="ars-col-main">
          <aside className="ars-sidebar" aria-label={t("resources:resourceAddSidebarAria")}>
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
          </aside>

          <ResourceFavoritesBar
            favorites={favorites}
            sectionTitle={labels.resourceFavoritesSectionTitle}
          />

          {!loading && resources.length > 0 && (
            <ResourceFilterSidebar
              tagCounts={tagCounts}
              selectedTags={selectedTags}
              toggleTag={toggleTag}
              clearTagFilter={clearTagFilter}
              fixOnly={fixOnly}
              fixCount={fixCount}
              onToggleFix={toggleFixOnly}
              fixLabel={labels.resourceFixLabel}
              loading={loading}
              resourcesLength={resources.length}
              filterByTagsLabel={labels.resourceFilterByTags}
              clearFiltersLabel={labels.resourceClearFilters}
            />
          )}

          <div className="ars-res-section">
            {loading ? (
              <div className="ars-state ars-state--loading">
                <Loader2 className="w-5 h-5 animate-spin" />
                <span>{labels.resourceLoading}</span>
              </div>
            ) : resources.length === 0 ? (
              <p className="ars-state">{labels.resourceNoResources}</p>
            ) : filteredResources.length === 0 ? (
              <p className="ars-state">{labels.resourceNoMatchingTags}</p>
            ) : (
              <ul className="ars-res-list">
                {filteredResources.map((r) => (
                  <ResourceListItem
                    key={r.id}
                    resource={r}
                    dense={dense}
                    titleUnavailableLabel={labels.resourceTitleUnavailable}
                    resourceFavoriteLabel={labels.resourceFavorite}
                    resourceEditLabel={labels.resourceEdit}
                    onOpenEdit={openEditModal}
                    onToggleFavorite={handleToggleFavorite}
                    onCopy={handleCopy}
                    onDelete={handleDelete}
                    onOpenNote={onOpenNote}
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
