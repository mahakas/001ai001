/**
 * LocaleProvider — owns the active interface language and the translator
 * built from the externalized string resources (FR-028).
 *
 * Presentation state only; localization *management* (preferences UI,
 * pluralization, formatting) is owned by R03 (A-04). The active locale feeds
 * the initial direction via DirectionProvider (FR-061).
 */

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import type { Locale } from "@mahak/contracts";
import { resolveInitialLocale } from "../i18n/index.js";
import { createTranslator, type Translator } from "../i18n/index.js";
import { getSavedLocale, setSavedLocale } from "./ShellPreferences.js";
import { logShellEvent } from "../logger/index.js";

interface LocaleContextValue {
  readonly locale: Locale;
  readonly t: Translator;
  readonly setLocale: (locale: Locale) => void;
}

const LocaleContext = createContext<LocaleContextValue | null>(null);

export { LocaleContext };

export interface LocaleProviderProps {
  readonly children?: ReactNode;
  /** Override the initial locale (tests). Defaults to the saved preference,
   * then the platform locale, then `fa`. */
  readonly initialLocale?: Locale;
}

function platformLocale(): string | null {
  try {
    return typeof navigator !== "undefined" ? navigator.language : null;
  } catch {
    return null;
  }
}

export function LocaleProvider({ children, initialLocale }: LocaleProviderProps) {
  const [locale, setLocaleState] = useState<Locale>(
    () => initialLocale ?? resolveInitialLocale(getSavedLocale(), platformLocale()),
  );

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next);
    setSavedLocale(next);
    // Direction follows the active locale when no explicit direction
    // preference is saved (FR-061); DirectionProvider emits the log record.
    logShellEvent("direction", { locale: next });
  }, []);

  const value = useMemo<LocaleContextValue>(
    () => ({ locale, t: createTranslator(locale), setLocale }),
    [locale, setLocale],
  );

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function useLocale(): LocaleContextValue {
  const context = useContext(LocaleContext);
  if (!context) {
    throw new Error("useLocale must be used inside a LocaleProvider");
  }
  return context;
}
