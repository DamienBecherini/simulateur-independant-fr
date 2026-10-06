// src/web/stockage-persistant.test.ts
// La demande de stockage persistant (stockage-navigateur.ts), une fois par visite.

import { describe, expect, it, vi } from "vitest"

async function demander() {
  vi.resetModules()
  return (await import("./stockage-navigateur")).demanderUnStockagePersistant
}

describe("stockage persistant", () => {
  it("le demande une seule fois par visite, sauf s'il est déjà accordé", async () => {
    const demanderUnStockagePersistant = await demander()
    const stockage = { persisted: vi.fn(async () => false), persist: vi.fn(async () => true) }
    expect(await demanderUnStockagePersistant(stockage)).toBe(true)
    expect(await demanderUnStockagePersistant(stockage)).toBe(false)
    expect(stockage.persist).toHaveBeenCalledOnce()

    const dejaAccorde = await demander()
    const accorde = { persisted: vi.fn(async () => true), persist: vi.fn(async () => true) }
    expect(await dejaAccorde(accorde)).toBe(true)
    expect(accorde.persist).not.toHaveBeenCalled()
  })

  it("rend faux si le navigateur refuse, échoue ou ne connaît pas la demande", async () => {
    expect(await (await demander())({ persisted: async () => false, persist: async () => false })).toBe(false)
    expect(await (await demander())({ persisted: async () => Promise.reject(new Error("indisponible")), persist: async () => true })).toBe(false)
    expect(await (await demander())(undefined)).toBe(false)
  })
})
