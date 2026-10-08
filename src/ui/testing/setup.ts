// src/ui/testing/setup.ts
// Préparation des tests de composants : matchers DOM, faux pont Electron et polyfills nécessaires à Radix sous jsdom.

import "@testing-library/jest-dom/vitest"
import { cleanup } from "@testing-library/react"
import { afterEach, beforeEach, vi } from "vitest"
import type { EventPayloadMapping } from "@/globals"
import type { SessionState } from "@/types"
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
    simulerLesAnnees: vi.fn(async (session: SessionState) => ({ annees: session.annees.map(({ annee }) => ({ annee, report: { ...emptyReport(), annee }, erreur: null })) })),
    comparerStrategies: vi.fn(async () => ({ annees: [], partMiseEnReserve: 0.5, statuts: [], notes: [] })),
    compareStatuts: vi.fn(async () => ({ scenarios: [], meilleur: null, couples: [], warnings: [] })),
    optimiserRemuneration: vi.fn(async (_session, _options, statut) => ({ statut, remunerationMaximale: 0, points: [], meilleur: null, meilleurAvecRetraite: null, warnings: [] })),
    getSaveSlots: vi.fn(async () => []),
    saveSlots: vi.fn(async () => {}),
    exportState: vi.fn(async () => {}),
    importState: vi.fn(async () => ({})),
    saveTextFile: vi.fn(async () => true),
    openTextFile: vi.fn(async () => null),
    printToPdf: vi.fn(async () => true),
    ouvrirAdresseExterne: vi.fn(async () => true),
    getUserPreferences: vi.fn(async () => ({ slotOrder: [] })),
    saveUserPreferences: vi.fn(async () => {}),
    onShowNotification: vi.fn(() => () => {}),
    infosDuServeurMcp: vi.fn(async () => null),
    propositionsEnAttente: vi.fn(async () => []),
    retirerProposition: vi.fn(async () => true),
    onPropositionsEnAttente: vi.fn(() => () => {})
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
// jsdom déclare window.scrollTo sans l'implémenter (il signale une erreur à chaque appel).
window.scrollTo = () => {}

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
