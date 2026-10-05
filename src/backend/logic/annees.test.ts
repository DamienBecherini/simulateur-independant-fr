// src/backend/logic/annees.test.ts

import { describe, expect, it } from "vitest"
import { ANNEE_PAR_DEFAUT, grilleVide, type AnneeSimulee, type FinancialFlow } from "../../types.js"
import { ajouterAnnee, anneeAAjouter, anneeExistante, anneesDeLaSession, anneesManquantes, donneesDeLAnnee, erreurDesAnnees, NOMBRE_MAX_ANNEES, nombreDeFlux, ordonnerLesAnnees, peutAjouterAnnee, peutSupprimerAnnee, remplacerGrille, supprimerAnnee, transformerLesGrilles, vueDeLAnnee, type SessionAnnuelle } from "./annees.js"
import { reglesEnVigueur } from "./regles.js"
import { personne } from "./testing/session-de-test.js"

const flux = (id: string, amount = 1000): FinancialFlow => ({ id, label: "Revenu", amount, entityId: "alice", type: "other_taxable_income" })

/** Une année dont janvier contient les flux donnés. */
function annee(numero: number, ...fluxDeJanvier: FinancialFlow[]): AnneeSimulee {
  const monthlyData = grilleVide()
  monthlyData[0].flows.push(...fluxDeJanvier)
  return { annee: numero, monthlyData }
}

function session(...annees: AnneeSimulee[]): SessionAnnuelle {
  return { name: "Test", entities: [personne("alice")], relationships: [], annees }
}

const compteur = () => {
  let n = 0
  return () => `copie-${++n}`
}

it("crée les nouvelles sessions dans la dernière année dont les règles sont connues", () => {
  expect(ANNEE_PAR_DEFAUT).toBe(reglesEnVigueur.annee)
})

describe("lecture des années", () => {
  const s = session(annee(2025, flux("a")), annee(2026, flux("b", 2000)))

  it("liste les années de la session", () => {
    expect(anneesDeLaSession(s)).toEqual([2025, 2026])
  })

  it("garde l'année demandée si elle existe, sinon prend la plus récente", () => {
    expect(anneeExistante(s, 2025)).toBe(2025)
    expect(anneeExistante(s, 2030)).toBe(2026)
    expect(anneeExistante(s, null)).toBe(2026)
    expect(anneeExistante(s, undefined)).toBe(2026)
  })

  it("donne au moteur les acteurs et les relations de la session avec la grille de l'année", () => {
    const donnees = donneesDeLAnnee(s, 2025)

    expect(donnees.entities).toBe(s.entities)
    expect(donnees.relationships).toBe(s.relationships)
    expect(donnees.monthlyData[0].flows.map(f => f.id)).toEqual(["a"])
  })

  it("donne une grille vide pour une année absente", () => {
    expect(nombreDeFlux([{ annee: 2030, monthlyData: donneesDeLAnnee(s, 2030).monthlyData }])).toBe(0)
  })

  it("présente une année comme une simulation d'un an, avec le nom de la session", () => {
    expect(vueDeLAnnee(s, 2025)).toMatchObject({ name: "Test", annee: 2025 })
    expect(vueDeLAnnee(s, 1999).annee).toBe(2026)
  })

  it("compte les flux de toutes les années", () => {
    expect(nombreDeFlux(s.annees)).toBe(2)
  })
})

describe("modification des grilles", () => {
  it("remplace la grille d'une seule année", () => {
    const s = session(annee(2025, flux("a")), annee(2026))
    const grille = annee(2026, flux("nouveau")).monthlyData

    const modifiee = remplacerGrille(s, 2026, grille)

    expect(modifiee.annees[0]).toBe(s.annees[0])
    expect(modifiee.annees[1].monthlyData).toBe(grille)
  })

  it("rend la même session si la grille est inchangée ou l'année absente", () => {
    const s = session(annee(2026))

    expect(remplacerGrille(s, 2026, s.annees[0].monthlyData)).toBe(s)
    expect(remplacerGrille(s, 2030, grilleVide())).toBe(s)
  })

  it("transforme la grille de chaque année", () => {
    const s = session(annee(2025, flux("a")), annee(2026, flux("b")))

    const videe = transformerLesGrilles(s, grille => grille.map(mois => ({ ...mois, flows: [] })))

    expect(nombreDeFlux(videe.annees)).toBe(0)
    expect(anneesDeLaSession(videe)).toEqual([2025, 2026])
  })
})

describe("ajout d'une année", () => {
  const s = session(annee(2025, flux("a")), annee(2026, flux("b", 2000)))

  it("ajoute l'année suivante, vide", () => {
    const ajoutee = ajouterAnnee(s, "apres", false, compteur())

    expect(anneeAAjouter(s, "apres")).toBe(2027)
    expect(anneesDeLaSession(ajoutee)).toEqual([2025, 2026, 2027])
    expect(nombreDeFlux([ajoutee.annees[2]])).toBe(0)
  })

  it("ajoute l'année suivante, copie de la plus récente, avec de nouveaux identifiants", () => {
    const ajoutee = ajouterAnnee(s, "apres", true, compteur())

    expect(ajoutee.annees[2].monthlyData[0].flows).toEqual([{ ...flux("b", 2000), id: "copie-1" }])
    // L'année copiée n'est pas touchée.
    expect(ajoutee.annees[1]).toBe(s.annees[1])
  })

  it("ajoute l'année précédente, copie de la plus ancienne", () => {
    const ajoutee = ajouterAnnee(s, "avant", true, compteur())

    expect(anneeAAjouter(s, "avant")).toBe(2024)
    expect(anneesDeLaSession(ajoutee)).toEqual([2024, 2025, 2026])
    expect(ajoutee.annees[0].monthlyData[0].flows).toEqual([{ ...flux("a"), id: "copie-1" }])
  })

  it("ajoute l'année précédente, vide", () => {
    expect(nombreDeFlux([ajouterAnnee(s, "avant", false, compteur()).annees[0]])).toBe(0)
  })
})

describe("suppression d'une année", () => {
  const s = session(annee(2024), annee(2025), annee(2026))

  it("supprime la plus ancienne ou la plus récente", () => {
    expect(anneesDeLaSession(supprimerAnnee(s, 2024))).toEqual([2025, 2026])
    expect(anneesDeLaSession(supprimerAnnee(s, 2026))).toEqual([2024, 2025])
  })

  it("refuse de supprimer une année du milieu, qui laisserait un trou", () => {
    expect(peutSupprimerAnnee(s, 2025)).toBe(false)
    expect(supprimerAnnee(s, 2025)).toBe(s)
  })

  it("refuse de supprimer la seule année de la session", () => {
    const seule = session(annee(2026))

    expect(peutSupprimerAnnee(seule, 2026)).toBe(false)
    expect(supprimerAnnee(seule, 2026)).toBe(seule)
  })
})

describe("ordonnerLesAnnees", () => {
  it("trie les années et écarte les doublons, en gardant la première occurrence", () => {
    const premiere2025 = annee(2025, flux("a"))
    const doublon2025 = annee(2025, flux("b"))

    const { annees, ecartees } = ordonnerLesAnnees([annee(2026), premiere2025, doublon2025, annee(2024)])

    expect(annees.map(a => a.annee)).toEqual([2024, 2025, 2026])
    expect(annees[1]).toBe(premiere2025)
    expect(ecartees).toEqual([doublon2025])
  })
})

describe("nombre maximal d'années", () => {
  const dixAnnees = session(...Array.from({ length: NOMBRE_MAX_ANNEES }, (_, i) => annee(2024 + i)))

  it("fixe la limite à dix années", () => {
    expect(NOMBRE_MAX_ANNEES).toBe(10)
  })

  it("permet d'ajouter une année tant que la limite n'est pas atteinte", () => {
    expect(peutAjouterAnnee(session(...dixAnnees.annees.slice(1)))).toBe(true)
    expect(peutAjouterAnnee(dixAnnees)).toBe(false)
  })

  it("n'ajoute pas d'année au-delà de la limite, ni avant ni après", () => {
    expect(ajouterAnnee(dixAnnees, "apres", true, compteur())).toBe(dixAnnees)
    expect(ajouterAnnee(dixAnnees, "avant", false, compteur())).toBe(dixAnnees)
  })

  it("ajoute la dixième année", () => {
    const neuf = session(...dixAnnees.annees.slice(0, 9))

    expect(anneesDeLaSession(ajouterAnnee(neuf, "apres", false, compteur()))).toHaveLength(10)
  })
})

describe("années manquantes et années refusées", () => {
  it("ne trouve aucune année manquante dans une suite consécutive, ou avec moins de deux années", () => {
    expect(anneesManquantes([2024, 2025, 2026])).toEqual([])
    expect(anneesManquantes([2026])).toEqual([])
    expect(anneesManquantes([])).toEqual([])
  })

  it("trouve les années absentes entre la plus ancienne et la plus récente", () => {
    expect(anneesManquantes([2024, 2027, 2029])).toEqual([2025, 2026, 2028])
  })

  it("accepte des années consécutives, jusqu'à dix", () => {
    expect(erreurDesAnnees([])).toBeNull()
    expect(erreurDesAnnees([2026])).toBeNull()
    expect(erreurDesAnnees(Array.from({ length: 10 }, (_, i) => 2024 + i))).toBeNull()
  })

  it("refuse plus de dix années, en disant combien il y en a et pourquoi", () => {
    expect(erreurDesAnnees(Array.from({ length: 11 }, (_, i) => 2024 + i))).toBe(
      "Cette simulation contient 11 années, de 2024 à 2034 ; le simulateur en accepte au plus 10. Au-delà de deux ou trois ans après les dernières règles connues, les chiffres ne sont plus qu'une projection."
    )
  })

  it("refuse des années qui ne se suivent pas, en nommant les années manquantes", () => {
    expect(erreurDesAnnees([2024, 2026])).toBe("Les années de cette simulation ne se suivent pas : il manque 2025 entre 2024 et 2026. Ajoutez les années manquantes au fichier, ou retirez les années isolées.")
    expect(erreurDesAnnees([2024, 2027, 2029])).toContain("il manque 2025, 2026 et 2028 entre 2024 et 2029")
  })

  it("compte les années manquantes plutôt que de toutes les nommer quand il y en a beaucoup", () => {
    expect(erreurDesAnnees([2024, 2031])).toContain("il manque 6 années entre 2024 et 2031")
    expect(erreurDesAnnees([2024, 2030])).toContain("il manque 2025, 2026, 2027, 2028 et 2029 entre 2024 et 2030")
  })
})
