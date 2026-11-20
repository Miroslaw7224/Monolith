"use client";

import { useTranslation } from "react-i18next";
import { type TFn } from "./index";

/**
 * `t` z subskrypcją na zmianę języka. Typ jak `i18n.t`: typy `t` z `useTranslation`
 * odrzucają klucze z interpolacją przy `strict: false` (i18next 27 wymaga `strictNullChecks`).
 */
export function useT(): TFn {
  const { t } = useTranslation();
  // Rzutowanie z powodu opisanego wyżej: zawężony `t` nie przyjmuje kluczy z interpolacją.
  return t as unknown as TFn;
}
