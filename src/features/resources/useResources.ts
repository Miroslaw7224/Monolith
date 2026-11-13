import { useState, useEffect, useMemo } from "react";
import type { NoteResource, TranslationDict } from "./resourceTypes";
import {
  collectResourceTags,
  filterResourcesBySearch,
  filterResourcesByTags,
  sortResourcesByFavorite,
} from "./resourceFilters";
import { parseMultipleBlocks } from "./resourceParsing";

export interface UseResourcesLabels {
  resourceDescriptionPlaceholder: string;
  resourceUrlPlaceholder: string;
  resourceTagsPlaceholder: string;
  addResource: string;
  resourceCopied: string;
  resourceTitleUnavailable: string;
  resourceDeleteConfirm: string;
  resourceNoResources: string;
  resourceBlockFormatLabel: string;
  resourceBlockFormatPlaceholder: string;
  resourceBlockFormatHint: string;
  resourceAddFromBlock: string;
  resourceBlockFormatError: string;
  resourceFilterByTags: string;
  resourceClearFilters: string;
  resourceNoMatchingTags: string;
  resourceFavorite: string;
  resourceEdit: string;
  resourceSaveEdit: string;
  resourceEditModalTitle: string;
  tabResources: string;
  resourceSearchPlaceholder: string;
  resourceFavoritesSectionTitle: string;
  noteCancelEdit: string;
}

function resolveLabels(t: TranslationDict): UseResourcesLabels {
  return {
    resourceDescriptionPlaceholder:
      (t.resourceDescriptionPlaceholder as string) ?? "Description (e.g. Color picker for project)",
    resourceUrlPlaceholder: (t.resourceUrlPlaceholder as string) ?? "URL",
    resourceTagsPlaceholder:
      (t.resourceTagsPlaceholder as string) ?? "Tags (comma-separated, optional)",
    addResource: (t.addResource as string) ?? "Add resource",
    resourceCopied: (t.resourceCopied as string) ?? "Copied!",
    resourceTitleUnavailable: (t.resourceTitleUnavailable as string) ?? "(title unavailable)",
    resourceDeleteConfirm: (t.resourceDeleteConfirm as string) ?? "Delete this resource?",
    resourceNoResources:
      (t.resourceNoResources as string) ?? "No resources yet. Add your first link.",
    resourceBlockFormatLabel: (t.resourceBlockFormatLabel as string) ?? "Or paste in block format:",
    resourceBlockFormatPlaceholder:
      (t.resourceBlockFormatPlaceholder as string) ??
      "Opis: Short description of the resource.\nURL: https://example.com\nTagi: tag1, tag2, tag3",
    resourceBlockFormatHint:
      (t.resourceBlockFormatHint as string) ??
      'Multiple resources: start each new block on a new line with "Opis:" or "Description:".',
    resourceAddFromBlock: (t.resourceAddFromBlock as string) ?? "Add from pasted block",
    resourceBlockFormatError:
      (t.resourceBlockFormatError as string) ??
      "Could not parse. Required: URL: and Opis: (or Description:).",
    resourceFilterByTags: (t.resourceFilterByTags as string) ?? "Filter by tags",
    resourceClearFilters: (t.resourceClearFilters as string) ?? "Clear filters",
    resourceNoMatchingTags:
      (t.resourceNoMatchingTags as string) ?? "No resources match the selected tags.",
    resourceFavorite: (t.resourceFavorite as string) ?? "Favorite",
    resourceEdit: (t.resourceEdit as string) ?? "Edit",
    resourceSaveEdit: (t.resourceSaveEdit as string) ?? "Save",
    resourceEditModalTitle: (t.resourceEditModalTitle as string) ?? "Edit resource",
    tabResources: (t.tabResources as string) ?? "Zasoby",
    resourceSearchPlaceholder:
      (t.resourceSearchPlaceholder as string) ?? "Search by title, description or URL",
    resourceFavoritesSectionTitle: (t.resourceFavoritesSectionTitle as string) ?? "Favorite links",
    noteCancelEdit: (t.noteCancelEdit as string) ?? "Cancel",
  };
}

export interface UseResourcesResult {
  resources: NoteResource[];
  loading: boolean;
  searchQuery: string;
  setSearchQuery: (v: string) => void;
  allTags: string[];
  selectedTags: string[];
  toggleTag: (tag: string) => void;
  clearTagFilter: () => void;
  filteredResources: NoteResource[];
  labels: UseResourcesLabels;
  // Add form
  addDescription: string;
  setAddDescription: (v: string) => void;
  addUrl: string;
  setAddUrl: (v: string) => void;
  addTags: string;
  setAddTags: (v: string) => void;
  adding: boolean;
  formExpanded: boolean;
  setFormExpanded: (v: boolean | ((prev: boolean) => boolean)) => void;
  handleAdd: () => Promise<void>;
  // Block format
  blockFormatText: string;
  setBlockFormatText: (v: string) => void;
  blockFormatError: string | null;
  setBlockFormatError: (v: string | null) => void;
  blockFormatExpanded: boolean;
  setBlockFormatExpanded: (v: boolean | ((prev: boolean) => boolean)) => void;
  handleAddFromBlock: () => Promise<void>;
  copyMessage: string | null;
  // List item actions
  handleCopy: (url: string) => Promise<void>;
  handleDelete: (resourceId: string) => Promise<void>;
  openEditModal: (r: NoteResource) => void;
  handleToggleFavorite: (r: NoteResource) => Promise<void>;
  // Edit modal
  editingResource: NoteResource | null;
  editForm: {
    title: string;
    description: string;
    url: string;
    tags: string;
    isFavorite: boolean;
  };
  setEditForm: React.Dispatch<
    React.SetStateAction<{
      title: string;
      description: string;
      url: string;
      tags: string;
      isFavorite: boolean;
    }>
  >;
  closeEditModal: () => void;
  handleSaveEdit: () => Promise<void>;
}

export function useResources(
  apiFetch: (url: string, options?: RequestInit) => Promise<Response>,
  t: TranslationDict
): UseResourcesResult {
  const [resources, setResources] = useState<NoteResource[]>([]);
  const [loading, setLoading] = useState(true);
  const [addDescription, setAddDescription] = useState("");
  const [addUrl, setAddUrl] = useState("");
  const [addTags, setAddTags] = useState("");
  const [adding, setAdding] = useState(false);
  const [copyMessage, setCopyMessage] = useState<string | null>(null);
  const [blockFormatText, setBlockFormatText] = useState("");
  const [blockFormatError, setBlockFormatError] = useState<string | null>(null);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [formExpanded, setFormExpanded] = useState(true);
  const [blockFormatExpanded, setBlockFormatExpanded] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [editingResource, setEditingResource] = useState<NoteResource | null>(null);
  const [editForm, setEditForm] = useState({
    title: "",
    description: "",
    url: "",
    tags: "",
    isFavorite: false,
  });

  const labels = useMemo(() => resolveLabels(t), [t]);

  const allTags = useMemo(() => collectResourceTags(resources), [resources]);

  const filteredResources = useMemo(
    () =>
      sortResourcesByFavorite(
        filterResourcesBySearch(filterResourcesByTags(resources, selectedTags), searchQuery)
      ),
    [resources, selectedTags, searchQuery]
  );

  const toggleTag = (tag: string) => {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((x) => x !== tag) : [...prev, tag]
    );
  };

  const clearTagFilter = () => setSelectedTags([]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    apiFetch("/api/resources")
      .then((r) => r.json())
      .then((data) => {
        if (!cancelled) setResources(Array.isArray(data) ? data : []);
      })
      .catch(() => {
        if (!cancelled) setResources([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [apiFetch]);

  const handleAdd = async () => {
    const description = addDescription.trim();
    const url = addUrl.trim();
    if (!description || !url) return;
    setAdding(true);
    try {
      const tags = addTags
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      const res = await apiFetch("/api/resources", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description, url, tags }),
      });
      if (res.ok) {
        const resource = await res.json();
        setResources((prev) => [resource, ...prev]);
        setAddDescription("");
        setAddUrl("");
        setAddTags("");
      }
    } catch (err) {
      console.error("Add resource failed", err);
    } finally {
      setAdding(false);
    }
  };

  const handleAddFromBlock = async () => {
    setBlockFormatError(null);
    const parsedList = parseMultipleBlocks(blockFormatText);
    if (parsedList.length === 0) {
      setBlockFormatError(labels.resourceBlockFormatError);
      return;
    }
    setAdding(true);
    const added: NoteResource[] = [];
    let hadError = false;
    try {
      for (const parsed of parsedList) {
        try {
          const res = await apiFetch("/api/resources", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              description: parsed.description,
              url: parsed.url,
              tags: parsed.tags.length ? parsed.tags : undefined,
            }),
          });
          if (res.ok) {
            const resource = await res.json();
            added.push(resource);
          } else {
            hadError = true;
          }
        } catch {
          hadError = true;
        }
      }
      if (added.length > 0) {
        setResources((prev) => [...added, ...prev]);
        setBlockFormatText("");
        const count = added.length;
        const msg =
          count === 1
            ? ((t.resourceAddedOne as string) ?? "Added 1 resource")
            : ((t.resourceAddedCount as string) ?? `Added ${count} resources`).replace(
                "{n}",
                String(count)
              );
        setCopyMessage(msg);
        setTimeout(() => setCopyMessage(null), 3000);
      }
      if (hadError && added.length === 0) {
        setBlockFormatError(labels.resourceBlockFormatError);
      }
    } catch (err) {
      console.error("Add resources from block failed", err);
      setBlockFormatError(labels.resourceBlockFormatError);
    } finally {
      setAdding(false);
    }
  };

  const handleCopy = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      setCopyMessage(labels.resourceCopied);
      setTimeout(() => setCopyMessage(null), 2000);
    } catch (err) {
      console.error("Copy failed", err);
    }
  };

  const handleDelete = async (resourceId: string) => {
    if (!window.confirm(labels.resourceDeleteConfirm)) return;
    try {
      await apiFetch(`/api/resources/${resourceId}`, {
        method: "DELETE",
      });
      setResources((prev) => prev.filter((r) => r.id !== resourceId));
    } catch (err) {
      console.error("Delete resource failed", err);
    }
  };

  const openEditModal = (r: NoteResource) => {
    setEditingResource(r);
    setEditForm({
      title: r.title ?? "",
      description: r.description ?? "",
      url: r.url ?? "",
      tags: (r.tags || []).join(", "),
      isFavorite: r.isFavorite === true,
    });
  };

  const closeEditModal = () => {
    setEditingResource(null);
  };

  const handleSaveEdit = async () => {
    if (!editingResource) return;
    const tags = editForm.tags
      .split(/[,;]/)
      .map((s) => s.trim())
      .filter(Boolean);
    const payload: {
      title?: string;
      description?: string;
      url?: string;
      tags?: string[];
      isFavorite?: boolean;
    } = {};
    if (editForm.title.trim()) payload.title = editForm.title.trim();
    if (editForm.description.trim()) payload.description = editForm.description.trim();
    if (editForm.url.trim()) payload.url = editForm.url.trim();
    payload.tags = tags;
    payload.isFavorite = editForm.isFavorite;
    try {
      const res = await apiFetch(`/api/resources/${editingResource.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        const updated = await res.json();
        setResources((prev) =>
          prev.map((r) => (r.id === editingResource.id ? { ...r, ...updated, id: r.id } : r))
        );
        closeEditModal();
      }
    } catch (err) {
      console.error("Update resource failed", err);
    }
  };

  const handleToggleFavorite = async (r: NoteResource) => {
    const next = !r.isFavorite;
    try {
      const res = await apiFetch(`/api/resources/${r.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isFavorite: next }),
      });
      if (res.ok) {
        setResources((prev) =>
          prev.map((item) => (item.id === r.id ? { ...item, isFavorite: next } : item))
        );
      }
    } catch (err) {
      console.error("Toggle favorite failed", err);
    }
  };

  return {
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
  };
}
