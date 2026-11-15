import { useState, useEffect, useMemo, useCallback } from "react";
import type { NoteResource } from "./resourceTypes";
import {
  collectResourceTags,
  countResourceTags,
  filterResourcesBySearch,
  filterResourcesByTags,
  filterResourcesNeedingFix,
  sortResourcesByFavorite,
  type TagCount,
} from "./resourceFilters";
import { parseMultipleBlocks } from "./resourceParsing";
import { useT } from "@/src/i18n/useT";
import type { TFn } from "@/src/i18n";

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
  resourceFixLabel: string;
  resourceLoading: string;
}

function resolveLabels(t: TFn): UseResourcesLabels {
  return {
    resourceDescriptionPlaceholder: t("resources:resourceDescriptionPlaceholder"),
    resourceUrlPlaceholder: t("resources:resourceUrlPlaceholder"),
    resourceTagsPlaceholder: t("resources:resourceTagsPlaceholder"),
    addResource: t("resources:addResource"),
    resourceCopied: t("resources:resourceCopied"),
    resourceTitleUnavailable: t("resources:resourceTitleUnavailable"),
    resourceDeleteConfirm: t("resources:resourceDeleteConfirm"),
    resourceNoResources: t("resources:resourceNoResources"),
    resourceBlockFormatLabel: t("resources:resourceBlockFormatLabel"),
    resourceBlockFormatPlaceholder: t("resources:resourceBlockFormatPlaceholder"),
    resourceBlockFormatHint: t("resources:resourceBlockFormatHint"),
    resourceAddFromBlock: t("resources:resourceAddFromBlock"),
    resourceBlockFormatError: t("resources:resourceBlockFormatError"),
    resourceFilterByTags: t("resources:resourceFilterByTags"),
    resourceClearFilters: t("resources:resourceClearFilters"),
    resourceNoMatchingTags: t("resources:resourceNoMatchingTags"),
    resourceFavorite: t("resources:resourceFavorite"),
    resourceEdit: t("resources:resourceEdit"),
    resourceSaveEdit: t("resources:resourceSaveEdit"),
    resourceEditModalTitle: t("resources:resourceEditModalTitle"),
    tabResources: t("resources:resourceArsenalTitle"),
    resourceSearchPlaceholder: t("resources:resourceSearchPlaceholder"),
    resourceFavoritesSectionTitle: t("resources:resourceFavoritesSectionTitle"),
    noteCancelEdit: t("planning:calendarCancel"),
    resourceFixLabel: t("resources:resourceFixLabel"),
    resourceLoading: t("resources:resourceLoading"),
  };
}

const DENSE_KEY = "monolith.resources.dense";

function readDense(): boolean {
  try {
    return window.localStorage.getItem(DENSE_KEY) === "1";
  } catch {
    return false;
  }
}

export interface UseResourcesResult {
  resources: NoteResource[];
  loading: boolean;
  searchQuery: string;
  setSearchQuery: (v: string) => void;
  allTags: string[];
  tagCounts: TagCount[];
  selectedTags: string[];
  toggleTag: (tag: string) => void;
  clearTagFilter: () => void;
  clearAllFilters: () => void;
  fixOnly: boolean;
  toggleFixOnly: () => void;
  fixCount: number;
  dense: boolean;
  setDense: (v: boolean) => void;
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
  apiFetch: (url: string, options?: RequestInit) => Promise<Response>
): UseResourcesResult {
  const t = useT();
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
  const [fixOnly, setFixOnly] = useState(false);
  const [dense, setDenseState] = useState(false);
  useEffect(() => setDenseState(readDense()), []);
  const setDense = (value: boolean) => {
    setDenseState(value);
    try {
      window.localStorage.setItem(DENSE_KEY, value ? "1" : "0");
    } catch {
      /* brak storage: wybór działa tylko do końca sesji */
    }
  };
  const [formExpanded, setFormExpanded] = useState(false);
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
  const tagCounts = useMemo(() => countResourceTags(resources), [resources]);

  const fixCount = useMemo(() => filterResourcesNeedingFix(resources).length, [resources]);

  const filteredResources = useMemo(() => {
    const byTags = filterResourcesByTags(resources, selectedTags);
    const byFix = fixOnly ? filterResourcesNeedingFix(byTags) : byTags;
    return sortResourcesByFavorite(filterResourcesBySearch(byFix, searchQuery));
  }, [resources, selectedTags, fixOnly, searchQuery]);

  const toggleTag = (tag: string) => {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((x) => x !== tag) : [...prev, tag]
    );
  };

  const clearTagFilter = () => {
    setSelectedTags([]);
    setFixOnly(false);
  };

  const clearAllFilters = useCallback(() => {
    setSelectedTags([]);
    setFixOnly(false);
    setSearchQuery("");
  }, []);

  const toggleFixOnly = () => setFixOnly((v) => !v);

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
        setCopyMessage(t("resources:resourceAdded", { count: added.length }));
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
          prev.map((r) =>
            r.id === editingResource.id
              ? { ...r, ...updated, id: r.id, notePath: updated.notePath }
              : r
          )
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
  };
}
