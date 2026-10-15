/**
 * ShellModeProvider — the public vs authenticated boundary as a two-valued
 * contract (FR-042, FR-043, FR-044, FR-045, FR-046, FR-058).
 *
 * - Exposes exactly two values: `public` and `authenticated`. No third
 *   ("loading"/"unknown") mode exists (FR-042).
 * - The mode is resolved from the shell-mode seam — the `GET /api/v1/shell`
 *   contract with a local fallback — never from any login implementation
 *   (FR-046).
 * - Changing the mode swaps navigation sets and global actions without
 *   reloading or restructuring the shell frame (FR-045).
 * - While `public`, no module destination is visible or routable; reaching a
 *   module route resolves to the sign-in entry point (FR-044, FR-058).
 *
 * R01 exposes `setShellMode` so the test harness (and later R02) can drive the
 * boundary through the seam; R01 implements no authentication.
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
import type { ShellMode } from "@mahak/contracts";
import { DEFAULT_SHELL_MODE, isShellMode } from "@mahak/contracts";
import {
  fetchShellContract,
  LOCAL_SHELL_CONTRACT,
  type ShellContractResponse,
} from "../services/ShellApiClient.js";
import { logShellEvent } from "../logger/index.js";

interface ShellModeContextValue {
  readonly shellMode: ShellMode;
  readonly isAuthenticated: boolean;
  /** The contract payload last resolved from the seam (local fallback on
   * failure), or `null` until the first attempt settles. */
  readonly contract: ShellContractResponse | null;
  /** Drive the boundary through the seam (test harness / R02). */
  readonly setShellMode: (mode: ShellMode) => void;
}

const ShellModeContext = createContext<ShellModeContextValue | null>(null);

export interface ShellModeProviderProps {
  readonly children?: ReactNode;
  /** Override the initial mode (tests); skips the seam fetch when provided. */
  readonly initialMode?: ShellMode;
  /** Skip the seam fetch entirely (tests / E2E without an api). */
  readonly skipSeam?: boolean;
}

/**
 * R01 shell-mode seam override.
 *
 * R01 implements no authentication (FR-046), so there is no login flow to
 * produce `authenticated`. The mode is exposed through the shell-mode seam;
 * for deterministic demonstration and E2E verification the seam accepts an
 * explicit `?shellMode=authenticated|public` override. R02 replaces this
 * override with real session resolution while preserving the two values, the
 * navigation-set behavior, and the header sign-in entry point
 * (contracts/shell-mode.md, A-03).
 */
function readSeamOverride(): ShellMode | null {
  try {
    if (typeof window === "undefined" || !window.location) return null;
    const value = new URLSearchParams(window.location.search).get("shellMode");
    return isShellMode(value) ? value : null;
  } catch {
    return null;
  }
}

export function ShellModeProvider({ children, initialMode, skipSeam }: ShellModeProviderProps) {
  const [shellMode, setShellModeState] = useState<ShellMode>(
    () => initialMode ?? readSeamOverride() ?? DEFAULT_SHELL_MODE,
  );
  const [contract, setContract] = useState<ShellContractResponse | null>(null);

  // Keep a controlled override in sync (test harness / R02 driving the seam).
  useEffect(() => {
    if (initialMode && initialMode !== shellMode) {
      setShellModeState(initialMode);
    }
  }, [initialMode, shellMode]);

  // Resolve the mode from the seam with a local fallback (FR-046, FR-055).
  // A failure here MUST NOT break the shell (client resilience rule).
  useEffect(() => {
    if (initialMode || skipSeam || readSeamOverride()) return;
    const controller = new AbortController();
    let settled = false;

    fetchShellContract(controller.signal)
      .then((resolved) => {
        if (settled) return;
        settled = true;
        if (resolved) {
          setContract(resolved);
          setShellModeState(resolved.shellMode);
          logShellEvent("shell-mode", { from: "seam", mode: resolved.shellMode });
        } else {
          setContract(LOCAL_SHELL_CONTRACT);
          logShellEvent("shell-mode", { from: "local-fallback", mode: DEFAULT_SHELL_MODE });
        }
      })
      .catch(() => {
        if (settled) return;
        settled = true;
        setContract(LOCAL_SHELL_CONTRACT);
      });

    return () => {
      settled = true;
      controller.abort();
    };
  }, [initialMode, skipSeam]);

  const setShellMode = useCallback((mode: ShellMode) => {
    setShellModeState(mode);
    logShellEvent("shell-mode", { from: "seam-override", mode });
  }, []);

  const value = useMemo<ShellModeContextValue>(
    () => ({
      shellMode,
      isAuthenticated: shellMode === "authenticated",
      contract,
      setShellMode,
    }),
    [shellMode, contract, setShellMode],
  );

  return <ShellModeContext.Provider value={value}>{children}</ShellModeContext.Provider>;
}

export function useShellMode(): ShellModeContextValue {
  const context = useContext(ShellModeContext);
  if (!context) {
    throw new Error("useShellMode must be used inside a ShellModeProvider");
  }
  return context;
}
