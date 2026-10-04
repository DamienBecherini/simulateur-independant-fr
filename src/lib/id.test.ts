// src/lib/id.test.ts

import { afterEach, describe, expect, it, vi } from "vitest"
import { createId } from "@/lib/id"

afterEach(() => {
  vi.useRealTimers()
})

describe("createId", () => {
  it("fait précéder un UUID du préfixe demandé", () => {
    expect(createId("flow")).toMatch(/^flow-[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/)
  })

  it("ne dépend pas de l'horloge : aucun doublon sur 1 000 identifiants créés dans la même milliseconde", () => {
    vi.useFakeTimers()
    vi.setSystemTime(1_700_000_000_000)

    const ids = Array.from({ length: 1000 }, () => createId("rel"))

    expect(new Set(ids).size).toBe(1000)
  })
})
