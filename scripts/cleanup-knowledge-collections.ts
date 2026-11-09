/**
 * One-off script: delete knowledgeNodes and knowledgeEdges subcollections for all users.
 * Run manually (not in CI):
 *   npx tsx scripts/cleanup-knowledge-collections.ts
 *
 * Requires Firebase Admin credentials (same as the app).
 */
import type { CollectionReference } from "firebase-admin/firestore";
import { getFirestore } from "@/lib/firebase-admin";

const USERS = "users";
const NODES = "knowledgeNodes";
const EDGES = "knowledgeEdges";
const BATCH_SIZE = 400;

async function deleteCollection(collectionRef: CollectionReference): Promise<number> {
  let deleted = 0;
  for (;;) {
    const snap = await collectionRef.limit(BATCH_SIZE).get();
    if (snap.empty) break;
    const batch = getFirestore().batch();
    snap.docs.forEach((doc) => batch.delete(doc.ref));
    await batch.commit();
    deleted += snap.size;
  }
  return deleted;
}

async function main() {
  const db = getFirestore();
  const usersSnap = await db.collection(USERS).get();
  let totalNodes = 0;
  let totalEdges = 0;

  for (const userDoc of usersSnap.docs) {
    const nodesDeleted = await deleteCollection(userDoc.ref.collection(NODES));
    const edgesDeleted = await deleteCollection(userDoc.ref.collection(EDGES));
    totalNodes += nodesDeleted;
    totalEdges += edgesDeleted;
    if (nodesDeleted || edgesDeleted) {
      console.log(`user ${userDoc.id}: deleted ${nodesDeleted} nodes, ${edgesDeleted} edges`);
    }
  }

  console.log(`Done. Total nodes=${totalNodes}, edges=${totalEdges}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
