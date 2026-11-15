import { describe, expect, test } from "vitest";
import { resources } from "@/src/i18n/resources";

const PLURAL_SUFFIX = /_(zero|one|two|few|many|other)$/;

function flatten(obj: Record<string, unknown>, prefix = ""): string[] {
  return Object.entries(obj).flatMap(([k, v]) =>
    typeof v === "string"
      ? [`${prefix}${k}`.replace(PLURAL_SUFFIX, "")]
      : flatten(v as Record<string, unknown>, `${prefix}${k}.`)
  );
}

const unique = (xs: string[]) => [...new Set(xs)].sort();

describe("parytet słowników PL/EN", () => {
  test("te same namespace'y", () => {
    expect(Object.keys(resources.en).sort()).toEqual(Object.keys(resources.pl).sort());
  });

  test.each(Object.keys(resources.pl))(
    "namespace %s: te same klucze (bez sufiksów plural)",
    (ns) => {
      const pl = unique(flatten(resources.pl[ns as keyof typeof resources.pl]));
      const en = unique(flatten(resources.en[ns as keyof typeof resources.en]));
      expect(en).toEqual(pl);
    }
  );

  test("żadna wartość nie jest pusta", () => {
    for (const lang of ["pl", "en"] as const) {
      for (const [ns, dict] of Object.entries(resources[lang])) {
        const empty = JSON.stringify(dict).includes('":""');
        expect(empty, `${lang}/${ns} ma pustą wartość`).toBe(false);
      }
    }
  });
});
