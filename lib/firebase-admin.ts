import admin from "firebase-admin";

let firestore: admin.firestore.Firestore | null = null;

/**
 * Initialize Firebase Admin and return Firestore.
 * Uses env vars: FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY
 * or GOOGLE_APPLICATION_CREDENTIALS path to service account JSON.
 * When FIRESTORE_EMULATOR_HOST is set, connects to the emulator with optional project ID (no credentials required).
 */
function getFirestore(): admin.firestore.Firestore {
  if (firestore) return firestore;

  if (!admin.apps?.length) {
    const emulatorHost = process.env.FIRESTORE_EMULATOR_HOST;
    const projectId = process.env.FIREBASE_PROJECT_ID ?? process.env.GCLOUD_PROJECT;

    if (emulatorHost) {
      admin.initializeApp({
        projectId: projectId || "demo-monolith",
      });
    } else {
      const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
      const privateKey = process.env.FIREBASE_PRIVATE_KEY;

      if (projectId && clientEmail && privateKey) {
        const key = privateKey.replace(/\\n/g, "\n");
        admin.initializeApp({
          credential: admin.credential.cert({
            projectId,
            clientEmail,
            privateKey: key,
          }),
        });
      } else if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
        admin.initializeApp({ credential: admin.credential.applicationDefault() });
      } else {
        throw new Error(
          "Firebase not configured: set FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY or GOOGLE_APPLICATION_CREDENTIALS"
        );
      }
    }
  }

  firestore = admin.firestore();
  return firestore;
}

/**
 * Get Firebase Auth (for migration script: createUser, getUserByEmail, etc.).
 * Ensures Admin is initialized (via getFirestore).
 */
export function getAuth() {
  getFirestore();
  return admin.auth();
}

/**
 * Verify Firebase ID token and return the user's uid.
 * Ensures Admin is initialized (via getFirestore).
 */
export async function verifyIdToken(idToken: string): Promise<string> {
  const decoded = await getAuth().verifyIdToken(idToken);
  return decoded.uid;
}

export { getFirestore };
