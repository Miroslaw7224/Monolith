/**
 * Eksport Firestore do plików (etap 0a). Tylko odczyt.
 *
 *   npx tsx --env-file=.env scripts/export-firestore.ts --count-only
 *   npx tsx --env-file=.env scripts/export-firestore.ts [--out <katalog>] [--skip-auth] [--uid <uid>]
 *   npx tsx --env-file=.env scripts/export-firestore.ts --resume --out <katalog>
 *   npx tsx --env-file=.env scripts/export-firestore.ts --verify <katalog>
 *
 * Poświadczenia jak w aplikacji (FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY
 * albo GOOGLE_APPLICATION_CREDENTIALS). Z FIRESTORE_EMULATOR_HOST działa na emulatorze.
 *
 * Kody wyjścia: 0 ok, 1 błąd lub niezgodność liczności, 2 nieznana kolekcja z danymi (do decyzji).
 */
import { getAuth, getFirestore } from "@/lib/firebase-admin";
import { parseCliArgs } from "./export-firestore/args";
import { defaultOutDir } from "./export-firestore/guard";
import { countReport, formatCountReport, runExport } from "./export-firestore/run";
import { verifyDump } from "./export-firestore/verify";

async function main(): Promise<number> {
  const args = parseCliArgs(process.argv.slice(2));
  const db = getFirestore();

  if (args.mode === "count-only") {
    console.log(formatCountReport(await countReport(db)));
    return 0;
  }

  if (args.mode === "verify") {
    const result = await verifyDump(args.dir, db);
    if (result.ok) {
      console.log(`Weryfikacja ${args.dir}: OK (pliki zgodne z manifestem i z Firestore).`);
      return 0;
    }
    console.error(`Weryfikacja ${args.dir}: NIEPOWODZENIE`);
    for (const problem of result.problems) console.error(`  - ${problem}`);
    return 1;
  }

  const outDir = args.out ?? defaultOutDir();
  console.log(`Katalog wyjściowy: ${outDir}`);
  const manifest = await runExport({
    db,
    auth: args.skipAuth ? undefined : getAuth(),
    outDir,
    pageSize: args.pageSize,
    resume: args.resume,
    uid: args.uid,
    log: (message) => console.log(message),
  });

  console.log("");
  for (const c of manifest.collections) {
    const same = c.before === c.lines && c.lines === c.after;
    console.log(
      `${same ? "OK  " : "ROZJAZD"} ${c.path}: przed=${c.before} plik=${c.lines} po=${c.after}${c.known ? "" : "  (NIEZNANA)"}`
    );
  }
  if (manifest.ghosts.length > 0) console.log(`Dokumenty-widma: ${manifest.ghosts.join(", ")}`);
  if ("ok" in manifest.auth && manifest.auth.ok === false) {
    console.warn(`Uwaga: nie wyeksportowano kont Auth: ${manifest.auth.error}`);
  }
  console.log(`\nStatus: ${manifest.status}  (dokumentów: ${manifest.totals.documents})`);

  if (manifest.status === "mismatch") return 1;
  if (manifest.status === "needs-review") {
    console.error(
      "Wykryto nieznane kolekcje z danymi. Przejrzyj je, zanim przejdziesz do kroku 0b."
    );
    return 2;
  }
  return 0;
}

main()
  .then((code) => process.exit(code))
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
