/**
 * Router — binds navigation destination ids to route slots and renders content
 * into the main region (FR-003, FR-014, FR-044).
 *
 * - Route slots are generated from the registry data, so a future module binds
 *   its route without touching the shell's regions or layout (FR-014).
 * - Reaching an authenticated destination from public mode resolves to the
 *   defined sign-in entry point rather than exposing protected content
 *   (FR-044, FR-058).
 * - The active destination stays in sync with the URL (FR-010) so back/forward
 *   navigation updates the indication.
 *
 * R02 (T022) binds the auth routes declared in contracts/auth.md to the real
 * registration and Google callback surfaces. `SignInPage` is a US2 deliverable
 * (T028); until it exists `/sign-in` keeps rendering the R01 entry-point state,
 * which is also the redirect target of `RequireAuthenticated`.
 */

import { type ReactNode, useEffect } from "react";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { R01_RESERVED_DESTINATIONS } from "@mahak/contracts";
import { useNavigation } from "../shell/navigation/NavigationRegistry.js";
import { useShellMode } from "../providers/ShellModeProvider.js";
import { useLocale } from "../providers/LocaleProvider.js";
import { EmptyState } from "../shell/states/EmptyState.js";
import { ReservedDestination } from "../shell/navigation/ReservedDestination.js";
import { ShellState } from "../shell/states/ShellState.js";
import { GoogleCallbackPage } from "../pages/GoogleCallbackPage.js";
import { SignUpPage } from "../pages/SignUpPage.js";

/**
 * Guard: authenticated destinations reached from public mode resolve to the
 * sign-in entry point (FR-044). R01 implements no authentication — the guard
 * is a contract seam that R02 will back with a real session (FR-046).
 */
export function RequireAuthenticated({ children }: { children: ReactNode }) {
  const { shellMode } = useShellMode();
  if (shellMode === "public") {
    return <Navigate to="/sign-in" replace />;
  }
  return <>{children}</>;
}

/** The defined public sign-in entry point (FR-058). No auth logic (FR-046).
 *
 * T022 maps `/sign-in` to the real `SignInPage`; that component is a US2
 * deliverable (T028) and is not yet available, so the R01 entry-point state
 * remains in place. It is also the redirect target of `RequireAuthenticated`,
 * so removing it without a replacement would break the guard contract. */
export function SignInEntry() {
  const { t } = useLocale();
  return (
    <ShellState
      state="entry"
      title={t("state.entry.signIn.title")}
      message={t("state.entry.signIn.message")}
    />
  );
}

/** Home: no feature content — the defined empty state (FR-048). */
export function HomeRoute() {
  return <EmptyState />;
}

/** Keeps the registry's active destination in sync with the current URL. */
function useActiveDestinationSync() {
  const { registry, activate, clearActive } = useNavigation();
  const location = useLocation();

  useEffect(() => {
    const destination = registry.findByRoutePath(location.pathname);
    if (destination) {
      activate(destination.id);
    } else {
      clearActive();
    }
  }, [location.pathname, registry, activate, clearActive]);
}

export function ShellRoutes() {
  useActiveDestinationSync();

  return (
    <Routes>
      <Route path="/" element={<HomeRoute />} />
      {/* T022: real R02 surfaces replace the R01 entry-point placeholders.
          `/sign-in` still renders `SignInEntry` until T028 delivers
          `SignInPage`. */}
      <Route path="/sign-in" element={<SignInEntry />} />
      <Route path="/sign-up" element={<SignUpPage />} />
      {/* Public by design: the visitor arrives here from Google with a `code`
          before any session exists (FR-004, FR-015). */}
      <Route path="/google-callback" element={<GoogleCallbackPage />} />
      {R01_RESERVED_DESTINATIONS.map((destination) => (
        <Route
          key={destination.id}
          path={destination.routePath}
          element={
            <RequireAuthenticated>
              <ReservedDestination destinationId={destination.id} />
            </RequireAuthenticated>
          }
        />
      ))}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
