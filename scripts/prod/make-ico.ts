/**
 * Opakowuje plik PNG w kontener ICO (jeden wpis, dane PNG bez zmian).
 * Użycie: npx tsx scripts/prod/make-ico.ts <wejście.png> <wyjście.ico>
 */
import fs from "node:fs";
import { pathToFileURL } from "node:url";

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

export function pngToIco(png: Buffer): Buffer {
  if (png.length < 24 || !png.subarray(0, 8).equals(PNG_SIGNATURE)) {
    throw new Error("Wejście nie jest plikiem PNG");
  }
  const width = png.readUInt32BE(16);
  const height = png.readUInt32BE(20);
  const header = Buffer.alloc(22);
  header.writeUInt16LE(0, 0); // zarezerwowane
  header.writeUInt16LE(1, 2); // typ: ikona
  header.writeUInt16LE(1, 4); // liczba obrazów
  header[6] = width >= 256 ? 0 : width;
  header[7] = height >= 256 ? 0 : height;
  header[8] = 0; // liczba kolorów (0 = brak palety)
  header[9] = 0;
  header.writeUInt16LE(1, 10); // planes
  header.writeUInt16LE(32, 12); // bity na piksel
  header.writeUInt32LE(png.length, 14);
  header.writeUInt32LE(22, 18); // offset danych
  return Buffer.concat([header, png]);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [input, output] = process.argv.slice(2);
  if (!input || !output) {
    console.error("Użycie: npx tsx scripts/prod/make-ico.ts <wejście.png> <wyjście.ico>");
    process.exit(1);
  }
  fs.writeFileSync(output, pngToIco(fs.readFileSync(input)));
}
