const TRANSLIT: Record<string, string> = {
  ł: "l",
  Ł: "L",
  đ: "d",
  Đ: "D",
  ø: "o",
  Ø: "O",
  ß: "ss",
  æ: "ae",
  Æ: "AE",
  œ: "oe",
  Œ: "OE",
};

const MAX_SLUG = 80;
const RESERVED = /^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])$/;

/**
 * Nazwa pliku z tytułu: tylko `[a-z0-9-]`, małe litery, nigdy pusta. Ukośniki, odwrotne ukośniki
 * i `..` nie przeżywają, więc wynik nie może wyjść poza katalog (P3 specu 0c).
 */
export function slugify(title: string): string {
  const translit = title.replace(/[łŁđĐøØßæÆœŒ]/g, (ch) => TRANSLIT[ch]);
  const ascii = translit.normalize("NFD").replace(/[̀-ͯ]/g, "");
  let slug = ascii
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  slug = slug.slice(0, MAX_SLUG).replace(/-+$/, "");
  if (slug === "") return "bez-tytulu";
  if (RESERVED.test(slug)) return `${slug}-`;
  return slug;
}

/** `base`, a gdy zajęte `base-2`, `base-3`, … */
export function allocateName(base: string, isTaken: (name: string) => boolean): string {
  if (!isTaken(base)) return base;
  for (let n = 2; ; n++) {
    const candidate = `${base}-${n}`;
    if (!isTaken(candidate)) return candidate;
  }
}
