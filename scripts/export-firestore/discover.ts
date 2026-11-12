import type { CollectionReference, Firestore } from "firebase-admin/firestore";

export type Discovery = {
  /** Wszystkie kolekcje (także zagnieżdżone), posortowane po ścieżce. */
  collections: CollectionReference[];
  /** Dokumenty, które nie istnieją, ale mają podkolekcje (np. users/ghost). */
  ghosts: string[];
};

/**
 * Znajduje kolekcje bez zakładania ich listy. listDocuments zwraca także dokumenty-widma,
 * czyli takie, które nie istnieją, ale mają podkolekcje (get na kolekcji ich nie pokaże).
 * Koszt: jeden odczyt na dokument (uwzględnia go count-only).
 */
export async function discoverCollections(db: Firestore): Promise<Discovery> {
  const collections: CollectionReference[] = [];

  async function walk(col: CollectionReference): Promise<void> {
    collections.push(col);
    for (const docRef of await col.listDocuments()) {
      for (const sub of await docRef.listCollections()) await walk(sub);
    }
  }

  for (const col of await db.listCollections()) await walk(col);
  collections.sort((a, b) => a.path.localeCompare(b.path));

  const parentPaths: string[] = [];
  for (const col of collections) {
    const parent = col.parent;
    if (parent && !parentPaths.includes(parent.path)) parentPaths.push(parent.path);
  }
  const ghosts: string[] = [];
  for (const parentPath of parentPaths) {
    const snap = await db.doc(parentPath).get();
    if (!snap.exists) ghosts.push(parentPath);
  }
  ghosts.sort();

  return { collections, ghosts };
}

/** Liczność kolekcji. Zapasowo (gdy emulator/serwer nie wspiera count) czyta same id dokumentów. */
export async function countDocs(col: CollectionReference): Promise<number> {
  try {
    const snap = await col.count().get();
    return snap.data().count;
  } catch {
    const snap = await col.select().get();
    return snap.size;
  }
}
