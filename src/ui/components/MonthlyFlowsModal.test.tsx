// src/ui/components/MonthlyFlowsModal.test.tsx

import { useState } from "react"
import { render, screen } from "@testing-library/react"
import userEvent, { type UserEvent } from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"
import type { Entity, FinancialFlow } from "@/types"
import { enTexteBrut, pourcent } from "@/backend/logic/format"
import { ANNEE_COURANTE, reglesPubliees } from "@/backend/logic/regles"
import { formatAmount } from "@/lib/amount-utils"
import { brutCalcule, netCalcule } from "@/lib/salary-utils"
import { makeFlow, makeMicro, makePerson } from "@/ui/testing/fixtures"
import { MonthlyFlowsModal } from "./MonthlyFlowsModal"
import type { FlowChanges } from "./FlowItem"
import type { NewFlowValues } from "./NewFlowItem"

/**
 * Rend la fenêtre des flux avec un état local, comme le fait `MonthlyGrid` : les créations, modifications
 * et suppressions sont appliquées à la liste affichée, et chaque appel est espionné.
 */
function renderModal({ flows = [] as FinancialFlow[], entity = makePerson() as Entity, annee = 2026, fluxDeLAnnee = [] as FinancialFlow[] } = {}) {
  const onCreate = vi.fn<(values: NewFlowValues) => void>()
  // Le montant de chaque création est-il annuel (à répartir sur les douze mois) ?
  const annuels = vi.fn<(annuel: boolean) => void>()
  const onUpdate = vi.fn<(flowId: string, changes: FlowChanges) => void>()
  const onDelete = vi.fn<(flowId: string) => void>()
  const onClose = vi.fn()

  function Harness() {
    const [currentFlows, setFlows] = useState(flows)
    return (
      <MonthlyFlowsModal
        flows={currentFlows}
        entity={entity}
        monthName="Mars"
        annee={annee}
        fluxDeLAnnee={fluxDeLAnnee}
        onClose={onClose}
        onCreate={(values, _portee, _aussiEn, annuel) => {
          onCreate(values)
          annuels(annuel)
          setFlows(previous => [...previous, { id: `flow-${previous.length + 1}`, entityId: entity.id, ...values }])
        }}
        onUpdate={(flowId, changes) => {
          onUpdate(flowId, changes)
          setFlows(previous => previous.map(flow => (flow.id === flowId ? { ...flow, ...changes } : flow)))
        }}
        onDelete={flowId => {
          onDelete(flowId)
          setFlows(previous => previous.filter(flow => flow.id !== flowId))
        }}
        onReorder={setFlows}
      />
    )
  }

  const user = userEvent.setup({ delay: null })
  render(<Harness />)
  return { user, onCreate, annuels, onUpdate, onDelete, onClose }
}

/** Choisit un type dans un sélecteur de type de flux ; par défaut celui de la ligne d'ajout, toujours le dernier. */
async function chooseType(user: UserEvent, label: string, index = -1) {
  const selects = screen.getAllByRole("combobox", { name: "Type de flux" })
  await user.click(selects[index < 0 ? selects.length + index : index])
  await user.click(await screen.findByRole("option", { name: label }))
}

const textbox = (name: string) => screen.getByRole("textbox", { name })

describe("MonthlyFlowsModal : ligne d'ajout", () => {
  it("place le focus sur le libellé de la ligne vide à l'ouverture", () => {
    renderModal()
    expect(textbox("Libellé du nouveau flux")).toHaveFocus()
  })

  it("crée le flux avec Entrée sur le montant et revient sur le libellé de la ligne vide", async () => {
    const { user, onCreate } = renderModal()

    await user.keyboard("Prime{Tab}1500{Enter}")

    expect(onCreate).toHaveBeenCalledTimes(1)
    expect(onCreate).toHaveBeenCalledWith({ type: "are", label: "Prime", amount: 1500 })
    expect(textbox("Libellé du nouveau flux")).toHaveFocus()
    expect(textbox("Libellé du nouveau flux")).toHaveValue("")
    expect(textbox("Montant du nouveau flux")).toHaveValue("")
    // Le flux créé apparaît dans la liste, éditable sur place.
    expect(textbox("Libellé")).toHaveValue("Prime")
  })

  it("accepte un montant à virgule et des espaces de milliers", async () => {
    const { user, onCreate } = renderModal()

    await user.type(textbox("Montant du nouveau flux"), "1 234,5{Enter}")

    expect(onCreate).toHaveBeenCalledWith(expect.objectContaining({ amount: 1234.5 }))
  })

  it("donne au flux le libellé de son type quand le libellé est laissé vide", async () => {
    const { user, onCreate } = renderModal()

    await user.type(textbox("Montant du nouveau flux"), "800{Enter}")

    expect(onCreate).toHaveBeenCalledWith({ type: "are", label: "Allocation chômage (ARE)", amount: 800 })
    // Un libellé par défaut s'affiche comme un champ vide.
    expect(textbox("Libellé")).toHaveValue("")
  })

  it("signale un montant invalide sans créer de flux", async () => {
    const { user, onCreate } = renderModal()
    const amount = textbox("Montant du nouveau flux")

    await user.type(amount, "12abc{Enter}")

    expect(amount).toHaveAttribute("aria-invalid", "true")
    expect(amount).toHaveAccessibleDescription(/Montant positif attendu/)
    expect(amount).toHaveFocus()
    expect(onCreate).not.toHaveBeenCalled()
  })

  it("vide le montant en cours avec Échap sans fermer la fenêtre", async () => {
    const { user, onCreate, onClose } = renderModal()
    const amount = textbox("Montant du nouveau flux")

    await user.type(amount, "500{Escape}")

    expect(amount).toHaveValue("")
    expect(onClose).not.toHaveBeenCalled()
    expect(screen.getByRole("dialog")).toBeInTheDocument()
    await user.tab()
    expect(onCreate).not.toHaveBeenCalled()
  })

  it("conserve le type choisi pour la saisie suivante", async () => {
    const { user, onCreate } = renderModal()

    await chooseType(user, "Autre revenu imposable")
    await user.type(textbox("Montant du nouveau flux"), "100{Enter}")

    expect(onCreate).toHaveBeenCalledWith(expect.objectContaining({ type: "other_taxable_income" }))
    const selects = screen.getAllByRole("combobox", { name: "Type de flux" })
    expect(selects[selects.length - 1]).toHaveTextContent("Autre revenu imposable")
  })
})

describe("MonthlyFlowsModal : lignes existantes", () => {
  const flow = makeFlow({ id: "flow-1", label: "Loyer perçu", amount: 1000 })

  it("enregistre un nouveau montant à la validation, en une seule modification", async () => {
    const { user, onUpdate } = renderModal({ flows: [flow] })
    const amount = textbox("Montant")

    await user.clear(amount)
    await user.type(amount, "1250,75{Enter}")

    expect(onUpdate).toHaveBeenCalledTimes(1)
    expect(onUpdate).toHaveBeenCalledWith("flow-1", { amount: 1250.75 })
    expect(amount).toHaveValue(formatAmount(1250.75))
  })

  it("signale un montant invalide par un message lié au champ, sans rien enregistrer", async () => {
    const { user, onUpdate } = renderModal({ flows: [flow] })
    const amount = textbox("Montant")

    await user.clear(amount)
    await user.type(amount, "mille")
    await user.tab()

    expect(onUpdate).not.toHaveBeenCalled()
    expect(amount).toHaveAttribute("aria-invalid", "true")
    const message = screen.getByRole("alert")
    expect(message).toHaveTextContent("Montant positif attendu")
    expect(amount).toHaveAccessibleDescription(message.textContent ?? "")
    expect(amount).toHaveValue("mille")
  })

  it("refuse aussi un montant négatif, avec le même message", async () => {
    const { user, onUpdate } = renderModal({ flows: [flow] })
    const amount = textbox("Montant")

    await user.clear(amount)
    await user.type(amount, "-500{Enter}")

    expect(onUpdate).not.toHaveBeenCalled()
    expect(screen.getByRole("alert")).toHaveTextContent("Montant positif attendu")
  })

  it("restaure l'ancien montant et retire le message avec Échap", async () => {
    const { user, onUpdate } = renderModal({ flows: [flow] })
    const amount = textbox("Montant")

    await user.clear(amount)
    await user.type(amount, "mille{Enter}")
    await user.keyboard("{Escape}")

    expect(onUpdate).not.toHaveBeenCalled()
    expect(screen.queryByRole("alert")).not.toBeInTheDocument()
    expect(amount).not.toHaveAttribute("aria-invalid", "true")
    expect(amount).toHaveValue(formatAmount(1000))
  })

  it("retire le message dès que le montant est corrigé, puis l'enregistre", async () => {
    const { user, onUpdate } = renderModal({ flows: [flow] })
    const amount = textbox("Montant")

    await user.clear(amount)
    await user.type(amount, "mille{Enter}")
    expect(screen.getByRole("alert")).toBeInTheDocument()
    await user.clear(amount)
    await user.type(amount, "1200{Enter}")

    expect(screen.queryByRole("alert")).not.toBeInTheDocument()
    expect(onUpdate).toHaveBeenCalledWith("flow-1", { amount: 1200 })
  })

  it("n'enregistre rien quand la valeur validée est inchangée", async () => {
    const { user, onUpdate } = renderModal({ flows: [flow] })
    const label = textbox("Libellé")

    await user.clear(label)
    await user.type(label, "Loyer perçu{Enter}")

    expect(onUpdate).not.toHaveBeenCalled()
  })

  it("annule la saisie d'un champ avec Échap, puis ferme la fenêtre au second Échap", async () => {
    const { user, onUpdate, onClose } = renderModal({ flows: [flow] })
    const label = textbox("Libellé")

    await user.clear(label)
    await user.type(label, "Autre chose{Escape}")

    expect(label).toHaveValue("Loyer perçu")
    expect(onClose).not.toHaveBeenCalled()

    await user.keyboard("{Escape}")
    expect(onClose).toHaveBeenCalledTimes(1)
    expect(onUpdate).not.toHaveBeenCalled()
  })

  it("supprime un flux avec son bouton", async () => {
    const { user, onDelete } = renderModal({ flows: [flow, makeFlow({ id: "flow-2", label: "Prime", amount: 300 })] })

    await user.click(screen.getAllByRole("button", { name: "Supprimer le flux" })[0])

    expect(onDelete).toHaveBeenCalledWith("flow-1")
    expect(screen.getAllByRole("textbox", { name: "Libellé" })).toHaveLength(1)
    expect(textbox("Libellé")).toHaveValue("Prime")
  })

  it("se parcourt au clavier : poignée, type, libellé, montant, puis suppression, qu'Entrée déclenche", async () => {
    const { user, onDelete } = renderModal({ flows: [flow] })

    screen.getByRole("button", { name: "Réordonner le flux" }).focus()
    await user.tab()
    expect(screen.getAllByRole("combobox", { name: "Type de flux" })[0]).toHaveFocus()
    await user.tab()
    expect(textbox("Libellé")).toHaveFocus()
    await user.tab()
    expect(textbox("Montant")).toHaveFocus()
    await user.tab()
    expect(screen.getByRole("button", { name: "Supprimer le flux" })).toHaveFocus()
    await user.keyboard("{Enter}")

    expect(onDelete).toHaveBeenCalledWith("flow-1")
  })

  it("change le type d'un flux en conservant un libellé personnalisé", async () => {
    const { user, onUpdate } = renderModal({ flows: [flow] })

    await chooseType(user, "Allocation chômage (ARE)", 0)

    expect(onUpdate).toHaveBeenCalledWith("flow-1", { type: "are" })
    expect(textbox("Libellé")).toHaveValue("Loyer perçu")
  })

  it("fait suivre le libellé par défaut quand le type change", async () => {
    const { user, onUpdate } = renderModal({ flows: [makeFlow({ id: "flow-1" })] })

    await chooseType(user, "Allocation chômage (ARE)", 0)

    expect(onUpdate).toHaveBeenCalledWith("flow-1", { type: "are", label: "Allocation chômage (ARE)" })
  })
})

describe("MonthlyFlowsModal : salaires", () => {
  /** Passe la ligne d'ajout en salaire et renvoie ses trois champs de montant. */
  async function chooseSalary(user: UserEvent) {
    await chooseType(user, "Salaire (emploi tiers)")
    return {
      gross: textbox("Salaire brut du nouveau flux"),
      ratio: textbox("Part du net dans le brut du nouveau flux, en pourcentage"),
      net: textbox("Salaire net du nouveau flux")
    }
  }

  it.each([2026, 2024])("calcule le brut avec les cotisations salariales de %i quand seul le net est saisi", async annee => {
    const { user, onCreate } = renderModal({ annee })
    const { net } = await chooseSalary(user)

    await user.type(net, "2000{Enter}")

    expect(onCreate).toHaveBeenCalledWith({ type: "salary", label: "Salaire (emploi tiers)", amount: 2000, grossAmount: brutCalcule(2000, reglesPubliees(annee)) })
    expect(screen.getByRole("dialog")).toHaveTextContent(`le brut est calculé avec les cotisations salariales de ${annee}`)
  })

  it("calcule le net avec les cotisations de l'année quand seul le brut est saisi", async () => {
    const { user, onCreate } = renderModal()
    const { gross, net } = await chooseSalary(user)
    const attendu = netCalcule(3000, reglesPubliees(2026))

    await user.type(gross, "3000")
    expect(net).toHaveValue(formatAmount(attendu))

    // Entrée sur le brut passe au net, Entrée sur le net crée le flux.
    await user.keyboard("{Enter}")
    expect(net).toHaveFocus()
    await user.keyboard("{Enter}")

    expect(onCreate).toHaveBeenCalledWith(expect.objectContaining({ amount: attendu, grossAmount: 3000 }))
  })

  it("calcule le brut à partir du net et du pourcentage saisi", async () => {
    const { user, onCreate } = renderModal()
    const { ratio, net } = await chooseSalary(user)

    await user.type(ratio, "80")
    await user.type(net, "2000{Enter}")

    expect(onCreate).toHaveBeenCalledWith(expect.objectContaining({ amount: 2000, grossAmount: 2500 }))
  })

  it("ignore un brut inférieur au net à la création", async () => {
    const { user, onCreate } = renderModal()
    const { gross, net } = await chooseSalary(user)

    await user.type(gross, "1500")
    await user.clear(net)
    await user.type(net, "2000{Enter}")

    expect(onCreate).toHaveBeenCalledWith({ type: "salary", label: "Salaire (emploi tiers)", amount: 2000 })
  })

  describe("sur une ligne existante", () => {
    const salary = makeFlow({ id: "flow-1", type: "salary", label: "Salaire (emploi tiers)", amount: 2340, grossAmount: 3000 })

    it("affiche le brut et la part du net dans le brut", () => {
      renderModal({ flows: [salary] })

      expect(textbox("Salaire brut")).toHaveValue(formatAmount(3000))
      expect(textbox("Part du net dans le brut, en pourcentage")).toHaveValue("78 %")
    })

    it("retire le brut quand il est vidé", async () => {
      const { user, onUpdate } = renderModal({ flows: [salary] })
      const gross = textbox("Salaire brut")

      await user.clear(gross)
      await user.tab()

      expect(onUpdate).toHaveBeenCalledWith("flow-1", { grossAmount: undefined })
      expect(gross).toHaveValue("")
    })

    it("refuse un brut inférieur au net et restaure l'ancien", async () => {
      const { user, onUpdate } = renderModal({ flows: [salary] })
      const gross = textbox("Salaire brut")

      await user.clear(gross)
      await user.type(gross, "2000{Enter}")

      expect(onUpdate).not.toHaveBeenCalled()
      expect(gross).toHaveValue(formatAmount(3000))
    })
  })
})

describe("MonthlyFlowsModal : nature du chiffre d'affaires d'une micro-entreprise", () => {
  const { cotisations, abattement } = reglesPubliees(ANNEE_COURANTE).microEntreprise
  const micro = () => makeMicro({ id: "m" })

  it("propose d'office les prestations libérales, cochées, avec les taux de l'année affichée et des exemples", () => {
    renderModal({ entity: micro(), annee: ANNEE_COURANTE })

    const types = screen.getAllByRole("combobox", { name: "Type de flux" })
    expect(types[types.length - 1]).toHaveTextContent("Prestations libérales (BNC)")
    const bnc = screen.getByRole("radio", { name: "Prestations libérales (BNC)" })
    expect(bnc).toBeChecked()
    expect(bnc).toHaveAccessibleDescription(`: cotisations de ${pourcent(cotisations.servicesBnc)} du chiffre d'affaires, abattement de ${pourcent(abattement.servicesBnc)} pour l'impôt. Par exemple : développeur, consultant, traducteur, ostéopathe.`)
    expect(screen.getByRole("radio", { name: "Prestations artisanales ou commerciales (BIC)" })).toHaveAccessibleDescription(new RegExp(`cotisations de ${pourcent(cotisations.servicesBic)}.*plombier`))
    expect(screen.getByRole("radio", { name: "Vente de marchandises (BIC)" })).toHaveAccessibleDescription(new RegExp(`cotisations de ${pourcent(cotisations.venteBic)}.*revente`))
    expect(screen.getByText(new RegExp(`^La nature fixe les taux de ${ANNEE_COURANTE}\\.`))).toBeInTheDocument()
  })

  it("propose d'office la nature déjà saisie pour l'activité dans l'année", () => {
    renderModal({ entity: micro(), annee: ANNEE_COURANTE, fluxDeLAnnee: [makeFlow({ entityId: "m", type: "ca_micro_services_bic" })] })

    expect(screen.getByRole("radio", { name: "Prestations artisanales ou commerciales (BIC)" })).toBeChecked()
  })

  it("cocher une nature change le type de la ligne d'ajout ; la vente fait paraître la note sur les achats", async () => {
    const { user, onCreate } = renderModal({ entity: micro(), annee: ANNEE_COURANTE })
    expect(screen.queryByText(/Vos achats/)).not.toBeInTheDocument()

    await user.click(screen.getByRole("radio", { name: "Vente de marchandises (BIC)" }))
    expect(screen.getByText(/^Vos achats \(marchandises, matériaux, outils\) ne se déduisent pas en micro-entreprise/)).toHaveTextContent(enTexteBrut(`l'abattement de ${pourcent(abattement.venteBic)} est censé les couvrir`))
    await user.type(textbox("Montant du nouveau flux"), "1000{Enter}")

    expect(onCreate).toHaveBeenCalledWith({ type: "ca_micro_vente", label: "Vente de marchandises (BIC)", amount: 1000 })
  })

  it("n'apparaît pas pour un autre acteur", () => {
    renderModal()
    expect(screen.queryByRole("radio")).not.toBeInTheDocument()
  })
})

describe("MonthlyFlowsModal : montant annuel", () => {
  const caseAnnuelle = () => screen.queryByRole("checkbox", { name: "Montant annuel, réparti sur les 12 mois" })

  it("la case fait du montant de la ligne d'ajout un montant annuel, à répartir sur les douze mois", async () => {
    const { user, annuels } = renderModal({ entity: makeMicro(), annee: ANNEE_COURANTE })

    await user.click(caseAnnuelle()!)
    expect(textbox("Montant du nouveau flux")).toHaveAttribute("placeholder", "Par an")
    expect(screen.getByText(new RegExp(`réparti sur les 12 mois de ${ANNEE_COURANTE}, au centime près`))).toBeInTheDocument()
    await user.type(textbox("Montant du nouveau flux"), "55000{Enter}")

    expect(annuels).toHaveBeenCalledWith(true)
  })

  it("n'est pas proposée pour un salaire, qui se saisit par mois", async () => {
    const { user } = renderModal({ annee: ANNEE_COURANTE })
    expect(caseAnnuelle()).toBeInTheDocument()

    await chooseType(user, "Salaire (emploi tiers)")
    expect(caseAnnuelle()).not.toBeInTheDocument()
  })
})
