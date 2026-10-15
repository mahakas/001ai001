/**
 * DirectionProvider — RTL/LTR layout direction (FR-023, FR-024, FR-025,
 * FR-026, FR-027, FR-061).
 *
 * - The active direction is set on the application root and is the single
 *   source of truth for layout direction (FR-024).
 * - The active language is the single source of truth for the *initial*
 *   direction when no saved preference exists, so the two cannot diverge at
 *   first paint (FR-061).
 * - Switching direction mirrors every region via logical CSS properties and
 *   requires no reload and no re-navigation (FR-025, FR-027).
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { Direction, Locale } from "@mahak/contracts";
import { resolveDirectionForLocale } from "@mahak/contracts";
import { getSavedDirection, setSavedDirection } from "./ShellPreferences.js";
import { logShellEvent } from "../logger/index.js";
import { LocaleContext } from "./LocaleProvider.js";

interface DirectionContextValue {
  readonly direction: Direction;
  readonly setDirection: (direction: Direction) => void;
  /** True while the direction is still derived from the active locale
   * (no explicit preference saved) — FR-061. */
  readonly isLocaleDriven: boolean;
}

const DirectionContext = createContext<DirectionContextValue | null>(null);

export interface DirectionProviderProps {
  readonly children?: ReactNode;
  /** Override the initial direction (tests). */
  readonly initialDirection?: Direction;
}

export function DirectionProvider({ children, initialDirection }: DirectionProviderProps) {
  // LocaleContext may be absent when DirectionProvider is used standalone in
  // a test; fall back to the default locale resolution.
  const localeContext = useContext(LocaleContext);
  const locale: Locale = localeContext?.locale ?? "fa";

  const [direction, setDirectionState] = useState<Direction>(
    () => initialDirection ?? getSavedDirection() ?? resolveDirectionForLocale(locale),
  );

  // FR-061: when the active language changes and no explicit direction
  // preference has been saved, the direction follows the language.
  useEffect(() => {
    if (getSavedDirection()) return;
    setDirectionState(resolveDirectionForLocale(locale));
    logShellEvent("direction", { from: "locale", locale, direction: resolveDirectionForLocale(locale) });
  }, [locale]);

  // FR-024: the root `dir` attribute is the single source of truth. Logical
  // CSS properties mirror every region from it (FR-025).
  useEffect(() => {
    if (typeof document === "undefined") return;
    document.documentElement.setAttribute("dir", direction);
  }, [direction]);

  const setDirection = useCallback((next: Direction) => {
    setDirectionState(next);
    setSavedDirection(next);
    logShellEvent("direction", { direction: next, explicit: true });
  }, []);

  const value = useMemo<DirectionContextValue>(
    () => ({ direction, setDirection, isLocaleDriven: !getSavedDirection() }),
    [direction, setDirection],
  );

  return <DirectionContext.Provider value={value}>{children}</DirectionContext.Provider>;
}

export function useDirection(): DirectionContextValue {
  const context = useContext(DirectionContext);
  if (!context) {
    throw new Error("useDirection must be used inside a DirectionProvider");
  }
  return context;
}
