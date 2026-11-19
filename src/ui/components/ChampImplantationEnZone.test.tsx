// src/ui/components/ChampImplantationEnZone.test.tsx
// Fenêtre de réglages d'une activité : « Aides liées au lieu d'implantation » (ADR 017). Repliée et sans effet tant que
// la case n'est pas cochée ; cochée, elle dit le régime de la date de création, son calendrier et les hypothèses du calcul.

import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"
import type { Entity } from "@/types"
import { makeCompany, makeMicro, makePerson } from "@/ui/testing/fixtures"
import { delaiDesTestsDIntegration } from "@/ui/testing/delais"
import EditEntityModal from "./EditEntityModal"

delaiDesTestsDIntegration()

function ouvrir(entity: Entity) {
  const onSave = vi.fn()
  render(<EditEntityModal entity={entity} isOpen onClose={() => {}} onSave={onSave} allEntities={[entity]} relationships={[]} annee={2026} />)
  return { onSave, user: userEvent.setup() }
}

const TITRE = "Aides liées au lieu d'implantation"
const CASE = "Activité implantée en zone franche urbaine (ZFU-TE) ou en quartier prioritaire (QPV)"
const section = () => screen.getByText(TITRE).closest("details")!
const laCase = () => screen.getByRole("switch", { name: CASE })
/** Les montants et les pourcentages portent des espaces insécables : on compare en espaces simples. */
const texteDe = (element: HTMLElement) => element.textContent.replace(/\s/g, " ")

describe("aides liées au lieu d'implantation", () => {
  it("la section est repliée, la case décochée, et rien n'est enregistré tant qu'on n'y touche pas", async () => {
    const { onSave, user } = ouvrir(makeCompany({ dateDeCreation: "2024-01" }))
    expect(section()).not.toHaveAttribute("open")
    await user.click(screen.getByRole("button", { name: "Enregistrer" }))
    expect(onSave.mock.calls[0][0]).not.toHaveProperty("implantationEnZone")
  })

  it("n'est proposée ni à une personne ni à une activité en portage", () => {
    ouvrir(makePerson())
    expect(screen.queryByText(TITRE)).not.toBeInTheDocument()
  })

  it("cochée pour une société créée en 2024 : régime ZFU-TE, calendrier, plafond et hypothèses du calcul", async () => {
    const { onSave, user } = ouvrir(makeCompany({ dateDeCreation: "2024-03" }))
    await user.click(screen.getByText(TITRE))
    expect(laCase()).not.toBeChecked()
    expect(laCase()).toHaveAccessibleDescription(/Le régime et le taux de chaque année se déduisent de la date de création/)
    expect(screen.queryByRole("status")).not.toBeInTheDocument()

    await user.click(laCase())
    expect(texteDe(within(section()).getByRole("status"))).toBe(
      "Créée en mars 2024 : régime ZFU-TE. Bénéfice exonéré d'impôt en totalité jusqu'à fin février 2029, puis à 60 %, 40 % et 20 % par périodes de douze mois, jusqu'à fin février 2032. Bénéfice exonéré plafonné à 50 000 € par an."
    )
    const hypotheses = within(screen.getByRole("list", { name: "Ce que ce calcul suppose" })).getAllByRole("listitem")
    expect(hypotheses).toHaveLength(2)
    expect(hypotheses[0]).toHaveTextContent("Une année à cheval sur deux taux d'exonération est répartie également entre ses mois")
    expect(screen.getByRole("link", { name: "Vérifier une adresse sur la carte officielle" })).toHaveAttribute("href", "https://sig.ville.gouv.fr/")

    await user.click(screen.getByRole("button", { name: "Enregistrer" }))
    // À 100 % du chiffre d'affaires dans la zone, seule la case est enregistrée.
    expect(onSave.mock.calls[0][0].implantationEnZone).toEqual({})
  })

  it("une création depuis 2026 relève du régime QPV, sans plafond, avec une hypothèse de plus", async () => {
    const { user } = ouvrir(makeMicro({ dateDeCreation: "2026-07" }))
    await user.click(screen.getByText(TITRE))
    await user.click(laCase())
    expect(texteDe(within(section()).getByRole("status"))).toMatch(/^Créée en juillet 2026 : régime QPV\. .*jusqu'à fin juin 2031, .*jusqu'à fin juin 2034\. Aucun plafond annuel\.$/)
    const hypotheses = within(screen.getByRole("list", { name: "Ce que ce calcul suppose" })).getAllByRole("listitem")
    expect(hypotheses).toHaveLength(3)
    expect(hypotheses[2]).toHaveTextContent("L'administration n'a pas encore publié son commentaire de ce régime")
  })

  it("sans date de création, la section la demande et n'annonce aucun régime", async () => {
    const { user } = ouvrir(makeCompany())
    await user.click(screen.getByText(TITRE))
    await user.click(laCase())
    expect(within(section()).getByRole("status")).toHaveTextContent("Indiquez la date de création de l'activité, plus haut : le régime (ZFU-TE ou QPV) et le taux d'exonération en dépendent. Rien n'est exonéré en attendant.")
    expect(screen.queryByRole("list", { name: "Ce que ce calcul suppose" })).not.toBeInTheDocument()
  })

  it("la part du chiffre d'affaires réalisée dans la zone s'enregistre quand elle n'est pas de 100 %", async () => {
    const { onSave, user } = ouvrir(makeCompany({ dateDeCreation: "2024-01", implantationEnZone: {} }))
    // Déjà déclarée en zone : la section s'ouvre d'elle-même.
    expect(section()).toHaveAttribute("open")
    const part = screen.getByRole("spinbutton", { name: "Part du chiffre d'affaires réalisée dans la zone (%)" })
    expect(part).toHaveValue(100)
    expect(part).toHaveAccessibleDescription("Seul le bénéfice réalisé dans la zone est exonéré.")
    await user.clear(part)
    await user.type(part, "60")
    await user.click(screen.getByRole("button", { name: "Enregistrer" }))
    expect(onSave.mock.calls[0][0].implantationEnZone).toEqual({ partDuChiffreDAffaires: 0.6 })
  })

  it("décocher retire le champ, la phrase et les hypothèses, sans refermer la section", async () => {
    const { onSave, user } = ouvrir(makeCompany({ dateDeCreation: "2024-01", implantationEnZone: { partDuChiffreDAffaires: 0.6 } }))
    await user.click(laCase())
    expect(section()).toHaveAttribute("open")
    expect(screen.queryByRole("status")).not.toBeInTheDocument()
    expect(screen.queryByRole("spinbutton", { name: /Part du chiffre d'affaires/ })).not.toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: "Enregistrer" }))
    expect(onSave.mock.calls[0][0].implantationEnZone).toBeUndefined()
  })

  it("une micro-entreprise au versement libératoire est prévenue que l'exonération ne s'applique pas", () => {
    ouvrir(makeMicro({ dateDeCreation: "2026-01", opteVFL: true, implantationEnZone: {} }))
    expect(section()).toHaveTextContent("Avec le versement libératoire, l'exonération ne s'applique pas")
  })

  it("une activité créée avant 2015 n'a aucun régime : la section le dit", () => {
    ouvrir(makeCompany({ dateDeCreation: "2012-05", implantationEnZone: {} }))
    expect(texteDe(within(section()).getByRole("status"))).toBe("Aucun régime d'exonération pour une activité créée en mai 2012 (ZFU-TE : créations de janvier 2015 à décembre 2025 ; QPV : de janvier 2026 à décembre 2030). Rien n'est exonéré.")
  })
})
