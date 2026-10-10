// src/ui/components/SyntheseDuComparateur.test.tsx
// Lecture rapide du comparateur : cartes des statuts (affichage « Résumé » sur téléphone), écart de frais de gestion
// d'une colonne, situation saisie de référence, rappel des frais et invitation à saisir un chiffre d'affaires.

import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it } from "vitest"
import type { ComparaisonResult, ScenarioStatut, StatutCompare } from "@/types"
import { SANS_CHIFFRE_D_AFFAIRES } from "@/backend/logic/options-du-comparateur"
import { CartesDesStatuts, EcartDeFraisDeLaColonne, RappelDesFrais, SituationTelleQueSaisie, VerdictDuComparateur } from "./SyntheseDuComparateur"

const espaces = (texte: string | null) => texte?.replace(/\s/g, " ") ?? ""

function scenario(statut: StatutCompare, libelle: string, net: number, autres: Partial<ScenarioStatut> = {}): ScenarioStatut {
  return { statut, libelle, actuel: false, telleQueSaisie: false, ecartDeFrais: { total: 0, postes: {} }, resultatConserveActivite: 0, horsPlafond: false, protectionSociale: { etoiles: 3, trimestres: 4, resume: "" }, netApresImpots: net, revenusAvantPrelevements: 50000, totalPrelevements: 50000 - net, cotisationsSociales: 0, impotSocietes: 0, impotSurLeRevenu: 0, prelevementsSociaux: 0, resultatConserve: 0, warnings: [], ...autres }
}

describe("cartes des statuts", () => {
  it("disent qu'une colonne micro n'est pas retenue, plafond dépassé ou régime fermé, et l'écart de frais de gestion", () => {
    const sortie = { depuis: 2028, depassements: [2026, 2027] as [number, number] }
    const result: ComparaisonResult = {
      scenarios: [
        scenario("EI", "EI au réel", 30000, { actuel: true, telleQueSaisie: true }),
        scenario("micro", "Micro-entreprise", 32000, { horsPlafond: true, regimeMicroFerme: sortie, ecartDeFrais: { total: -1200, postes: { expertComptable: -1200 } } }),
        scenario("micro-vfl", "Micro + versement libératoire", 31000, { horsPlafond: true, ecartDeFrais: { total: -1200, postes: { expertComptable: -1200 } } })
      ],
      meilleur: "EI",
      situationSaisie: { statut: "EI", libelle: "EI au réel", netApresImpots: 30000 },
      couples: [],
      warnings: []
    }
    render(<CartesDesStatuts result={result} />)

    const cartes = within(screen.getByRole("list", { name: "Net dans la poche selon le statut" })).getAllByRole("listitem")
    expect(cartes[0]).toHaveTextContent(/^Micro-entreprisenon retenue : régime micro fermé ·/)
    expect(espaces(cartes[0].textContent)).toContain("dont environ 1 200 € de frais de gestion en moins qu'en EI au réel")
    expect(cartes[1]).toHaveTextContent(/^Micro \+ versement libératoirenon retenue : plafond dépassé ·/)
    expect(cartes[2]).toHaveTextContent(/^EI au réelactuel · meilleur net ·/)
  })
})

describe("écart de frais de gestion d'une colonne", () => {
  it("l'écrit sous le net, avec le détail des postes à déplier", async () => {
    const sasu = scenario("SASU", "SASU", 34000, { ecartDeFrais: { total: 2050, postes: { expertComptable: 2000, banque: 100, logiciel: 50, assurance: -100 } } })
    render(<EcartDeFraisDeLaColonne scenario={sasu} actuel="micro-vfl" />)

    const resume = screen.getByText(/dont environ/)
    expect(espaces(resume.textContent)).toContain("dont environ 2 050 € de frais de gestion en plus qu'en micro-entreprise")
    await userEvent.click(resume)
    expect(espaces(screen.getByText(/Expert-comptable/).textContent)).toBe("Expert-comptable : +2 000 €")
    expect(espaces(screen.getByText(/Assurance/).textContent)).toBe("Assurance responsabilité civile professionnelle : −100 €")
  })

  it("ne dit rien sans écart : statut actuel, ou mêmes frais", () => {
    const { container } = render(<EcartDeFraisDeLaColonne scenario={scenario("micro", "Micro-entreprise", 30000)} actuel="micro-vfl" />)
    expect(container).toBeEmptyDOMElement()
  })
})

describe("situation saisie et rappel des frais", () => {
  const optimisee = scenario("SASU", "SASU, rémunération optimisée", 41000, { actuel: true })
  const base: ComparaisonResult = { scenarios: [optimisee], meilleur: "SASU", situationSaisie: { statut: "SASU", libelle: "SASU", netApresImpots: 40000 }, couples: [], warnings: [] }

  it("rappelle le net de la situation saisie quand aucune colonne ne l'est", () => {
    render(<SituationTelleQueSaisie result={base} />)
    expect(espaces(screen.getByText(/Votre situation telle que saisie/).textContent)).toBe("Votre situation telle que saisie (SASU) : 40 000 € de net, comme dans les résultats. Les écarts du tableau se mesurent à partir de ce montant.")
  })

  it("ne la répète pas quand une colonne est la situation saisie", () => {
    const { container } = render(<SituationTelleQueSaisie result={{ ...base, scenarios: [{ ...optimisee, telleQueSaisie: true }] }} />)
    expect(container).toBeEmptyDOMElement()
  })

  it("rappelle que les frais réels sont ceux de la grille", () => {
    render(<RappelDesFrais result={base} />)
    expect(screen.getByText(/Vos frais réels sont ceux que vous avez saisis dans la grille : pensez à la CFE, à l'assurance, à la banque/)).toHaveTextContent("les frais communs à tous les statuts ne changent pas le classement")
  })

  it("sans chiffre d'affaires, invite à en saisir un au lieu de donner un verdict", () => {
    render(<VerdictDuComparateur result={{ ...base, meilleur: null, sansChiffreDAffaires: true, warnings: [SANS_CHIFFRE_D_AFFAIRES] }} activite="Conseil" />)
    expect(screen.getByRole("status")).toHaveTextContent(SANS_CHIFFRE_D_AFFAIRES)
  })
})
