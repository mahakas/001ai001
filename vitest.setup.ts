import "@testing-library/jest-dom/vitest";
import { afterEach, beforeEach, vi } from "vitest";
import { cleanup } from "@testing-library/react";

// Reset the DOM between component tests so no region leaks across suites.
afterEach(() => {
  cleanup();
  document.documentElement.removeAttribute("dir");
  document.documentElement.removeAttribute("data-theme");
  document.body.innerHTML = "";
});

beforeEach(() => {
  // jsdom has no matchMedia; theme/provider suites install their own stubs,
  // but a safe default keeps unrelated suites from throwing.
  if (!window.matchMedia) {
    window.matchMedia = (query: string) =>
      ({
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      }) as unknown as MediaQueryList;
  }
  // jsdom has no IntersectionObserver; drawer/scroll suites do not need one,
  // but components referencing it must not throw.
  if (!window.IntersectionObserver) {
    window.IntersectionObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
      takeRecords() {
        return [];
      }
    } as unknown as typeof IntersectionObserver;
  }
});

// jsdom does not implement layout, so getBoundingClientRect returns zeros.
// Sidebar collapse tests assert on a real width, so let suites override it.
if (!Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = () => {};
}
