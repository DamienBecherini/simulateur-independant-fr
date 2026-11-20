// src/ui/components/SyntheseDuComparateur.test.tsx
// Lecture rapide du comparateur : cartes des statuts (affichage « Résumé » sur téléphone), écart de frais de gestion
// d'une colonne, situation saisie de référence, rappel des frais et invitation à saisir un chiffre d'affaires.

import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it } from "vitest"
import type { ComparaisonResult, ScenarioStatut, StatutCompare } from "@/types"
import { AUCUNE_CHARGE, SANS_CHIFFRE_D_AFFAIRES } from "@/backend/logic/options-du-comparateur"
import { ESPACE_INSECABLE } from "@/backend/logic/format"
import { AffichageContext } from "../hooks/useAffichage"
import { BoutonDesPrecisions, CartesDesStatuts, EcartDeFraisDeLaColonne, EcartDeRepartitionDeLaColonne, RappelDesFrais, SituationTelleQueSaisie, VerdictDuComparateur } from "./SyntheseDuComparateur"

const espaces = (texte: string | null) => texte?.replace(/\s/g, " ") ?? ""

function scenario(statut: StatutCompare, libelle: string, net: number, autres: Partial<ScenarioStatut> = {}): ScenarioStatut {
  return { statut, libelle, actuel: false, telleQueSaisie: false, ecartDeFrais: { total: 0, postes: {} }, resultatConserveActivite: 0, horsPlafond: false, protectionSociale: { etoiles: 3, trimestres: 4, resume: "" }, netApresImpots: net, revenusAvantPrelevements: 50000, totalPrelevements: 50000 - net, cotisationsSociales: 0, impotSocietes: 0, impotSurLeRevenu: 0, prelevementsSociaux: 0, resultatConserve: 0, warnings: [], ...autres }
}

describe("cartes des statuts : le portage salarial", () => {
  const micro = scenario("micro", "Micro-entreprise", 30000, { actuel: true, telleQueSaisie: true })
  const avec = (portage: ScenarioStatut, meilleur: StatutCompare): ComparaisonResult => ({ scenarios: [micro, portage], meilleur, situationSaisie: { statut: "micro", libelle: "Micro-entreprise", netApresImpots: 30000 }, couples: [], warnings: [] })
  const cartes = () => within(screen.getByRole("list", { name: "Net dans la poche selon le statut" })).getAllByRole("listitem")

  it("a sa carte, avec ses cinq étoiles, son écart et les frais dont la société de portage se charge ; il peut être le meilleur net", () => {
    const portage = scenario("portage", "Portage salarial", 31000, { protectionSociale: { etoiles: 5, trimestres: 4, resume: "" }, ecartDeFrais: { total: -850, postes: { assurance: -850 } } })
    render(<CartesDesStatuts result={avec(portage, "portage")} />)
    expect(cartes()[0]).toHaveTextContent(/^Portage salarialmeilleur net ·/)
    expect(within(cartes()[0]).getByText("protection sociale 5 sur 5")).toBeInTheDocument()
    expect(espaces(cartes()[0].textContent)).toContain("dont environ 850 € de frais de fonctionnement en moins qu'en micro-entreprise")
    expect(espaces(cartes()[0].textContent)).toContain("+1 000 €")
  })

  it("non retenu, dit pourquoi", () => {
    render(<CartesDesStatuts result={avec(scenario("portage", "Portage salarial", 20000, { portageNonRetenu: "sansPrestations" }), "micro")} />)
    expect(cartes()[1]).toHaveTextContent(/^Portage salarialnon retenue : aucune prestation à facturer ·/)
  })
})

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

describe("écart de la colonne du statut actuel, simulée avec un autre partage que la grille", () => {
  const partage = (remunerationNette: number, dividendesNets: number) => ({ beneficeAvantRemuneration: 78000, remunerationNette, cotisationsRemuneration: 0, impotSocietes: 0, dividendesNets, cotisationsSurDividendes: 0, resultatConserve: 0 })
  const optimisee = scenario("SASU", "SASU, rémunération optimisée", 47204, { actuel: true, partage: partage(5800, 55211), impotSurLeRevenu: 3538, prelevementsSociaux: 10269 })
  const result: ComparaisonResult = {
    scenarios: [optimisee, scenario("EURL", "EURL", 45000)],
    meilleur: "SASU",
    situationSaisie: { statut: "SASU", libelle: "SASU", netApresImpots: 47960, repartition: { remunerationNette: 0, dividendes: 62750, impotSurLeRevenu: 3119, prelevementsSociaux: 11671, resultatConserve: 0 } },
    couples: [],
    warnings: []
  }

  it("dit ce qui la distingue de la situation saisie, et déplie chaque poste du net du foyer", async () => {
    render(<EcartDeRepartitionDeLaColonne result={result} scenario={optimisee} />)
    const resume = screen.getByText((_, element) => element?.tagName === "SUMMARY" && espaces(element.textContent).startsWith("avec 5 800 € de rémunération nette au lieu de 0 €"))
    expect(resume.closest("details")).not.toHaveAttribute("open")

    await userEvent.setup().click(resume)
    expect(resume.closest("details")).toHaveAttribute("open")
    const postes = within(resume.closest("details")!).getAllByRole("listitem").map(poste => espaces(poste.textContent))
    expect(postes).toEqual([
      "Rémunération nette : 5 800 € au lieu de 0 €, soit +5 800 €",
      "Dividendes : 55 211 € au lieu de 62 750 €, soit −7 539 €",
      "Impôt sur le revenu : 3 538 € au lieu de 3 119 €, soit −419 €",
      "Prélèvements sociaux : 10 269 € au lieu de 11 671 €, soit +1 402 €"
    ])
    expect(resume.closest("details")).toHaveTextContent("Même statut, autre partage du bénéfice.")
  })

  it("« Afficher tous les détails », dans le coin du tableau, déplie d'un geste les précisions de toutes les cases, puis les replie", async () => {
    const eurl = scenario("EURL", "EURL", 45000, { ecartDeFrais: { total: 300, postes: { expertComptable: 300 } } })
    const avecFrais = { ...result, scenarios: [optimisee, eurl] }
    render(
      <table>
        <thead>
          <tr>
            <th>
              <BoutonDesPrecisions result={avecFrais} />
            </th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>
              <EcartDeRepartitionDeLaColonne result={avecFrais} scenario={optimisee} />
              <EcartDeFraisDeLaColonne scenario={eurl} actuel="SASU" />
            </td>
          </tr>
        </tbody>
      </table>
    )
    const precisions = () => Array.from(document.querySelectorAll("details")).map(precision => precision.open)
    expect(precisions()).toEqual([false, false])
    const bouton = screen.getByRole("button", { name: "Afficher tous les détails" })
    expect(bouton).toHaveAttribute("aria-pressed", "false")
    await userEvent.click(bouton)
    expect(precisions()).toEqual([true, true])
    await userEvent.click(screen.getByRole("button", { name: "Masquer tous les détails" }))
    expect(precisions()).toEqual([false, false])
  })

  it("pas de bouton quand aucune case n'a de précision à déplier", () => {
    const sansPrecision = { ...result, scenarios: [scenario("SASU", "SASU", 47960, { actuel: true, telleQueSaisie: true }), scenario("EURL", "EURL", 45000)] }
    const { container } = render(<BoutonDesPrecisions result={sansPrecision} />)
    expect(container).toBeEmptyDOMElement()
  })

  it("rien sous une colonne d'un autre statut : son écart vient du statut", () => {
    const { container } = render(<EcartDeRepartitionDeLaColonne result={result} scenario={result.scenarios[1]} />)
    expect(container).toBeEmptyDOMElement()
  })

  it("sur téléphone, la carte du statut le dit en une ligne", () => {
    render(<CartesDesStatuts result={result} />)
    const carte = within(screen.getByRole("list", { name: "Net dans la poche selon le statut" })).getAllByRole("listitem")[0]
    expect(espaces(carte.textContent)).toContain("avec 5 800 € de rémunération nette au lieu de 0 €")
  })
})

describe("situation saisie et rappel des frais", () => {
  const optimisee = scenario("SASU", "SASU, rémunération optimisée", 41000, { actuel: true })
  const base: ComparaisonResult = { scenarios: [optimisee], meilleur: "SASU", situationSaisie: { statut: "SASU", libelle: "SASU", netApresImpots: 40000 }, couples: [], warnings: [] }

  it("rappelle le net de la situation saisie quand aucune colonne ne l'est", () => {
    render(<SituationTelleQueSaisie result={base} />)
    expect(espaces(screen.getByText(/Votre situation telle que saisie/).textContent)).toBe("Votre situation telle que saisie (SASU) : 40 000 € de net, comme dans les résultats. Les écarts du tableau se mesurent à partir de ce montant.")
  })

  it("dit ce que la situation saisie garde dans la société, non compté dans le net", () => {
    render(<SituationTelleQueSaisie result={{ ...base, situationSaisie: { ...base.situationSaisie!, beneficeGarde: 12000 } }} />)
    expect(espaces(screen.getByText(/Votre situation telle que saisie/).textContent)).toBe("Votre situation telle que saisie (SASU) : 40 000 € de net, comme dans les résultats. Les écarts du tableau se mesurent à partir de ce montant. Elle garde en plus 12 000 € dans la société, non comptés dans le net.")
  })

  it("ne la répète pas quand une colonne est la situation saisie", () => {
    const { container } = render(<SituationTelleQueSaisie result={{ ...base, scenarios: [{ ...optimisee, telleQueSaisie: true }] }} />)
    expect(container).toBeEmptyDOMElement()
  })

  it("rappelle que les frais réels sont ceux de la grille", () => {
    render(<RappelDesFrais result={base} />)
    expect(screen.getByText(/Vos frais réels sont ceux que vous avez saisis dans la grille : pensez à la CFE, à l'assurance, à la banque/)).toHaveTextContent("les frais communs à tous les statuts ne changent pas le classement")
  })

  it("sans charge saisie pour l'activité, alerte à la place du rappel des frais", () => {
    render(<RappelDesFrais result={{ ...base, warnings: [AUCUNE_CHARGE] }} />)
    const note = screen.getByRole("note")
    expect(note).toHaveTextContent("Aucune charge saisie pour cette activité : pensez à la CFE, à l'assurance, à la banque. Sans elles, un statut aux frais de gestion estimés plus bas que le vôtre paraît plus avantageux de toute l'économie de frais estimée.")
    expect(note).toHaveTextContent("Cette économie se règle dans « Frais de fonctionnement », plus haut.")
    expect(screen.queryByText(/^Vos frais réels/)).not.toBeInTheDocument()
  })

  it("meilleur statut sous la situation saisie : le verdict ne le présente pas comme un gain et explique l'écart", () => {
    const explication = `Valider 4 trimestres de retraite vous coûterait environ 756${ESPACE_INSECABLE}€ par rapport à votre situation telle que saisie.`
    const sous: ComparaisonResult = { ...base, scenarios: [{ ...optimisee, netApresImpots: 47204 }], situationSaisie: { statut: "SASU", libelle: "SASU", netApresImpots: 47960 }, sousLaSituationSaisie: { ecart: 756, raison: "trimestres", explication } }
    render(
      <AffichageContext.Provider value="resume">
        <VerdictDuComparateur result={sous} activite="Conseil" />
      </AffichageContext.Provider>
    )

    const verdict = screen.getByText(/^Pour « Conseil »/)
    expect(verdict).toHaveAttribute("id", "comparateur-verdict")
    expect(espaces(verdict.textContent)).toBe("Pour « Conseil », le meilleur des statuts comparés, SASU, rémunération optimisée, donnerait 47 204 €, contre 47 960 € pour votre situation telle que saisie (SASU). Valider 4 trimestres de retraite vous coûterait environ 756 € par rapport à votre situation telle que saisie.")
    expect(verdict).not.toHaveTextContent("soit")
  })

  it("sans chiffre d'affaires, invite à en saisir un au lieu de donner un verdict", () => {
    render(<VerdictDuComparateur result={{ ...base, meilleur: null, sansChiffreDAffaires: true, warnings: [SANS_CHIFFRE_D_AFFAIRES] }} activite="Conseil" />)
    expect(screen.getByRole("status")).toHaveTextContent(SANS_CHIFFRE_D_AFFAIRES)
  })
})
