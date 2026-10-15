/**
 * MAHAK application root — wires the shell's presentation providers and the
 * router around the single top-level shell (FR-001).
 *
 * Provider order is deliberate: the announcer is outermost so providers and
 * regions alike can announce (FR-040); locale feeds theme-independent
 * direction defaults (FR-061); viewport class feeds shell-mode-independent
 * navigation presentation (FR-016); shell mode feeds navigation-set filtering
 * (FR-043).
 */

import { BrowserRouter } from "react-router-dom";
import { AnnouncementProvider } from "./shell/accessibility/AnnouncementProvider.js";
import { AppShell } from "./shell/AppShell.js";
import { DirectionProvider } from "./providers/DirectionProvider.js";
import { LocaleProvider } from "./providers/LocaleProvider.js";
import { NavigationProvider } from "./shell/navigation/NavigationRegistry.js";
import { ShellModeProvider } from "./providers/ShellModeProvider.js";
import { ThemeProvider } from "./providers/ThemeProvider.js";
import { ViewportClassProvider } from "./providers/ViewportClassProvider.js";
import "./features/index.js";

export function App() {
  return (
    <AnnouncementProvider>
      <LocaleProvider>
        <ThemeProvider>
          <DirectionProvider>
            <ViewportClassProvider>
              <ShellModeProvider>
                <NavigationProvider>
                  <BrowserRouter>
                    <AppShell />
                  </BrowserRouter>
                </NavigationProvider>
              </ShellModeProvider>
            </ViewportClassProvider>
          </DirectionProvider>
        </ThemeProvider>
      </LocaleProvider>
    </AnnouncementProvider>
  );
}
