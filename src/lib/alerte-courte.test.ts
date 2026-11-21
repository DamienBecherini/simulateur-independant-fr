// src/lib/alerte-courte.test.ts

import { describe, expect, it } from "vitest"
import { couperLAlerte } from "./alerte-courte"

describe("une alerte en une ligne courte", () => {
  it("garde entière une alerte qui tient sur une ligne", () => {
    const texte = "Plusieurs dirigeants liés : la rémunération est attribuée au premier."
    expect(couperLAlerte(texte)).toEqual({ court: texte, coupeEnCours: false })
  })

  it("coupe au deux-points ; la suite, en phrase, va dans le détail", () => {
    const texte = "La société est déficitaire de 5 000 € : les charges et la rémunération (cotisations comprises) dépassent le chiffre d'affaires."
    expect(couperLAlerte(texte)).toEqual({ court: "La société est déficitaire de 5 000 €", detail: "Les charges et la rémunération (cotisations comprises) dépassent le chiffre d'affaires.", coupeEnCours: false })
  })

  it("préfère la première phrase quand le début avant le deux-points n'en dit pas assez", () => {
    const texte = "ACRE : cotisations réduites de 50 %. Elles financent aussi vos droits : pendant l'aide, vous validez moins de trimestres de retraite."
    expect(couperLAlerte(texte)).toEqual({ court: "ACRE : cotisations réduites de 50 %.", detail: "Elles financent aussi vos droits : pendant l'aide, vous validez moins de trimestres de retraite.", coupeEnCours: false })
  })

  it("écrit à la main la ligne courte d'une alerte au début trop long ; le détail est alors le texte entier", () => {
    const texte = "En 2027, les prestations libérales (90 000 €, avec « Atelier ») dépassent le plafond de la micro-entreprise pour cette activité (77 700 € au prorata) : le régime n'est conservé que deux ans."
    expect(couperLAlerte(texte)).toEqual({ court: "Plafond de la micro-entreprise dépassé en 2027", detail: texte, coupeEnCours: false })
    const titulaire = "« Sophie » est titulaire de plusieurs entreprises en nom propre (« Conseil » et « Atelier ») : une personne n'a qu'une entreprise individuelle, qui réunit toutes ses activités."
    expect(couperLAlerte(titulaire).court).toBe("« Sophie » : une seule entreprise individuelle par personne")
  })

  it("sans deux-points ni fin de phrase assez tôt, coupe au dernier espace de la ligne et garde le texte entier en détail", () => {
    const texte = "Une très longue alerte sans aucune ponctuation qui permette de la couper proprement avant la fin de la ligne attendue ni après"
    const coupee = couperLAlerte(texte)
    expect(coupee.coupeEnCours).toBe(true)
    expect(coupee.detail).toBe(texte)
    expect(texte.startsWith(coupee.court)).toBe(true)
    expect(coupee.court.length).toBeLessThanOrEqual(100)
    expect(coupee.court.endsWith(" ")).toBe(false)
  })
})
