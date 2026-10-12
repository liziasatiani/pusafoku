"use client";

import { createContext, useCallback, useContext } from "react";
import { translate, type Lang, type Tr, type Vars } from "@/lib/i18n";

export const LangContext = createContext<Lang>("en");

export function useLang(): Lang {
  return useContext(LangContext);
}

export function useTr(): Tr {
  const lang = useLang();
  return useCallback((text: string, vars?: Vars) => translate(lang, text, vars), [lang]);
}
