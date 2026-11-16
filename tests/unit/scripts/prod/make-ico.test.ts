// @vitest-environment node
import { describe, expect, it } from "vitest";
import { pngToIco } from "../../../../scripts/prod/make-ico";

/** Minimalny „PNG": sygnatura + IHDR z wymiarami (reszta nie jest czytana). */
function fakePng(width: number, height: number): Buffer {
  const b = Buffer.alloc(33);
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(b, 0);
  b.writeUInt32BE(13, 8);
  b.write("IHDR", 12, "ascii");
  b.writeUInt32BE(width, 16);
  b.writeUInt32BE(height, 20);
  return b;
}

describe("pngToIco", () => {
  it("buduje nagłówek ICO z jednym wpisem PNG i dołącza dane PNG", () => {
    const png = fakePng(180, 180);
    const ico = pngToIco(png);
    expect([...ico.subarray(0, 6)]).toEqual([0, 0, 1, 0, 1, 0]);
    expect(ico[6]).toBe(180); // szerokość
    expect(ico[7]).toBe(180); // wysokość
    expect(ico.readUInt16LE(10)).toBe(1); // planes
    expect(ico.readUInt16LE(12)).toBe(32); // bity na piksel
    expect(ico.readUInt32LE(14)).toBe(png.length); // rozmiar danych
    expect(ico.readUInt32LE(18)).toBe(22); // offset danych
    expect(ico.subarray(22).equals(png)).toBe(true);
  });

  it("wymiar 256 zapisuje jako 0", () => {
    const ico = pngToIco(fakePng(256, 256));
    expect(ico[6]).toBe(0);
    expect(ico[7]).toBe(0);
  });

  it("odrzuca plik, który nie jest PNG", () => {
    expect(() => pngToIco(Buffer.from("to nie png, ale dość długi tekst na nagłówek"))).toThrow(
      "PNG"
    );
  });
});
