// src/ui/testing/setup.ts
// Préparation des tests de composants : matchers DOM, faux pont Electron et polyfills nécessaires à Radix sous jsdom.

import "@testing-library/jest-dom/vitest"
import { cleanup } from "@testing-library/react"
import { afterEach, beforeEach, vi } from "vitest"
import type { EventPayloadMapping } from "@/globals"
import { emptyReport, emptySession } from "./fixtures"

/**
 * Faux `window.api` : chaque méthode est un `vi.fn()` qui résout une valeur neutre.
 * Un test peut en remplacer le comportement, par exemple `vi.mocked(window.api.getCurrentSession).mockResolvedValue(session)`.
 */
function createFakeApi(): EventPayloadMapping {
  return {
    getCurrentSession: vi.fn(async () => emptySession()),
    saveCurrentSession: vi.fn(async () => {}),
    saveCurrentSessionSync: vi.fn(),
    runMetaSimulation: vi.fn(async () => emptyReport()),
    compareStatuts: vi.fn(async () => ({ scenarios: [], meilleur: null, couples: [], warnings: [] })),
    getSaveSlots: vi.fn(async () => []),
    saveSlots: vi.fn(async () => {}),
    exportState: vi.fn(async () => {}),
    importState: vi.fn(async () => ({})),
    getUserPreferences: vi.fn(async () => ({ slotOrder: [] })),
    saveUserPreferences: vi.fn(async () => {}),
    onShowNotification: vi.fn(() => () => {})
  }
}

// --- Polyfills : API du navigateur absentes de jsdom mais utilisées par Radix (Select, Dialog, Switch) ---

class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
globalThis.ResizeObserver ??= ResizeObserverStub

Element.prototype.hasPointerCapture ??= () => false
Element.prototype.setPointerCapture ??= () => {}
Element.prototype.releasePointerCapture ??= () => {}
Element.prototype.scrollIntoView ??= () => {}
Element.prototype.scrollTo ??= () => {}

window.matchMedia ??= (query: string): MediaQueryList => ({
  matches: false,
  media: query,
  onchange: null,
  addListener: () => {},
  removeListener: () => {},
  addEventListener: () => {},
  removeEventListener: () => {},
  dispatchEvent: () => false
})

beforeEach(() => {
  window.api = createFakeApi()
})

afterEach(() => {
  cleanup()
  localStorage.clear()
  vi.restoreAllMocks()
})
