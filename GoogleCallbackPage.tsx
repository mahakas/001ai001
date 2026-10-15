/**
 * GoogleCallbackPage — handles the Google OAuth 2.0 callback (FR-004, FR-015,
 * FR-042).
 *
 * 1. Reads the `code` query parameter from the URL.
 * 2. Calls `AuthService.googleCallback(code)` which exchanges the code server-side
 *    and returns a redirect response with the session cookie already set.
 * 3. On success navigates to `/`; the shell's `ShellModeProvider` resolves
 *    `shellMode = "authenticated"` from the cookie via `GET /api/v1/shell`.
 * 4. On failure shows a generic error message and redirects to `/sign-in` so
 *    no provider detail or token leaks into the UI (FR-042).
 *
 * No provider token, secret, or session token is stored in browser application
 * code (NFR-003, NFR-006). The session cookie remains HttpOnly — this page
 * never reads `document.cookie`.
 */

import { useEffect, useId, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useLocale } from "../providers/LocaleProvider.js";
import { AuthService } from "../services/AuthService.js";

export function GoogleCallbackPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { t } = useLocale();
  const id = useId();

  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const code = searchParams.get("code");

    // Interrupted flow: no code parameter → redirect to sign-in (FR-048).
    if (!code) {
      setError(t("auth.google.errorInterrupted"));
      navigate("/sign-in", { replace: true });
      return;
    }

    // The service calls the callback endpoint with `redirect: "manual"` and
    // inspects the redirect status. The cookie is set server-side before the
    // redirect; we never read it in JS (NFR-006).
    AuthService.googleCallback(code)
      .then((succeeded) => {
        if (succeeded) {
          navigate("/", { replace: true });
        } else {
          setError(t("auth.google.errorFailure"));
          navigate("/sign-in", { replace: true });
        }
      })
      .catch(() => {
        setError(t("auth.google.errorFailure"));
        navigate("/sign-in", { replace: true });
      });
  }, [searchParams, navigate, t]);

  return (
    <section aria-labelledby={`${id}-title`} data-testid="google-callback-page">
      <h1 id={`${id}-title`}>{t("auth.google.loading")}</h1>
      {error ? (
        <div role="alert">
          <p>{error}</p>
          <a href="/sign-in">{t("action.retry")}</a>
        </div>
      ) : null}
    </section>
  );
}

export default GoogleCallbackPage;
