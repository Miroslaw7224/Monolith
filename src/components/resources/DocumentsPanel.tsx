"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { FileText, Loader2, Plus, Trash2 } from "lucide-react";

export interface DocumentItem {
  id: string;
  name: string;
  type: string;
  created_at: string;
}

export interface DocumentsPanelProps {
  apiFetch: (url: string, options?: RequestInit) => Promise<Response>;
  noDocs: string;
  documentsLabel: string;
}

export function DocumentsPanel({ apiFetch, noDocs, documentsLabel }: DocumentsPanelProps) {
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchDocuments = useCallback(async () => {
    try {
      const res = await apiFetch("/api/documents");
      const data = await res.json();
      setDocuments(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Failed to fetch documents", err);
      setDocuments([]);
    }
  }, [apiFetch]);

  useEffect(() => {
    void fetchDocuments();
  }, [fetchDocuments]);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const formData = new FormData();
    formData.append("file", file);
    setIsUploading(true);
    try {
      const res = await apiFetch("/api/upload", { method: "POST", body: formData });
      if (res.ok) await fetchDocuments();
    } catch (err) {
      console.error("Upload failed", err);
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleDeleteDoc = async (id: string) => {
    try {
      await apiFetch(`/api/documents/${id}`, { method: "DELETE" });
      await fetchDocuments();
    } catch (err) {
      console.error("Delete failed", err);
    }
  };

  return (
    <div className="border border-[var(--border)] rounded-2xl bg-[var(--surface)] p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-[var(--text)]">{documentsLabel}</h3>
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={isUploading}
          className="p-1.5 hover:bg-[var(--bg3)] rounded-lg transition-colors text-[var(--text)]"
          aria-label="Upload document"
        >
          {isUploading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Plus className="w-4 h-4" />
          )}
        </button>
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleUpload}
          className="hidden"
          accept=".txt,.md,.json"
        />
      </div>
      {documents.length === 0 ? (
        <div className="px-4 py-6 text-center border-2 border-dashed border-[var(--border)] rounded-2xl">
          <FileText className="w-8 h-8 text-[var(--text3)] mx-auto mb-2" />
          <p className="text-sm text-[var(--text3)]">{noDocs}</p>
        </div>
      ) : (
        <div className="space-y-1">
          {documents.map((doc) => (
            <div
              key={doc.id}
              className="group flex items-center justify-between p-3 hover:bg-[var(--bg2)] rounded-xl transition-all border border-transparent hover:border-[var(--bg3)]"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-8 h-8 bg-[var(--bg3)] rounded-lg flex items-center justify-center flex-shrink-0">
                  <FileText className="w-4 h-4 text-[var(--text)]" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{doc.name}</p>
                  <p className="text-[10px] text-[var(--text3)] uppercase font-bold">
                    {new Date(doc.created_at).toLocaleDateString()}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => void handleDeleteDoc(doc.id)}
                className="opacity-0 group-hover:opacity-100 p-1.5 hover:bg-red-50 text-red-400 rounded-lg transition-all"
                aria-label="Delete document"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
