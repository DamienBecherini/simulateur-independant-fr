// src/lib/rfr-n2.test.ts
// Le champ du RFR N-2 nomme les années qu'il couvre, et dit quand la simulation calcule elle-même ce revenu.

import { describe, expect, it } from "vitest"
import { anneesDuRfrSaisi, texteDuRfrN2 } from "./rfr-n2"

describe("revenu fiscal de référence N-2 d'une micro-entreprise", () => {
  it("une seule année simulée : le RFR de deux ans plus tôt, sur l'avis de l'année d'avant", () => {
    expect(texteDuRfrN2([2026])).toEqual({
      libelle: "Revenu fiscal de référence 2024",
      aide: "Revenu fiscal de référence 2024 du foyer, sur l'avis d'imposition reçu en 2025 : il décide de l'accès au versement libératoire en 2026."
    })
  })

  it("deux années : une seule valeur sert pour les deux", () => {
    expect(texteDuRfrN2([2026, 2025])).toEqual({
      libelle: "Revenu fiscal de référence 2023 et 2024",
      aide: "Revenu fiscal de référence 2023 et 2024 du foyer, sur les avis d'imposition reçus en 2024 et 2025 : il décide de l'accès au versement libératoire en 2025 et 2026. La même valeur sert pour 2025 et 2026."
    })
  })

  it("trois années ou plus : à partir de la troisième, la simulation calcule le RFR elle-même", () => {
    expect(anneesDuRfrSaisi([2024, 2025, 2026, 2027])).toEqual([2024, 2025])
    expect(texteDuRfrN2([2024, 2025, 2026, 2027]).aide).toMatch(/ Pour 2026 et 2027, la simulation utilise le revenu fiscal de référence qu'elle calcule elle-même\.$/)
  })

  it("sans année connue : le libellé générique", () => {
    expect(texteDuRfrN2([]).libelle).toBe("Revenu fiscal de référence d'il y a deux ans")
  })
})
