import { useState, useCallback } from "react";
import type { NoteRecord } from "@/types/records";

export type Note = NoteRecord;

export interface UseNotesDataResult {
  notes: Note[];
  fetchNotes: () => Promise<void>;
}

export function useNotesData(
  apiFetch: (url: string, options?: RequestInit) => Promise<Response>
): UseNotesDataResult {
  const [notes, setNotes] = useState<Note[]>([]);

  const fetchNotes = useCallback(async () => {
    try {
      const res = await apiFetch("/api/notes");
      const data = await res.json();
      setNotes(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Failed to fetch notes", err);
      setNotes([]);
    }
  }, [apiFetch]);

  return { notes, fetchNotes };
}
