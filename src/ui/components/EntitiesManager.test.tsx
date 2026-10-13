// src/ui/components/EntitiesManager.test.tsx
// Changer le statut d'une activité depuis sa fiche : une seule modification de la session (une seule étape d'historique
// d'annulation).

import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { useState } from "react"
import { describe, expect, it, vi } from "vitest"
import type { Entity, FinancialFlow, Relationship, SessionState } from "@/types"
import { emptySession, makeCompany, makeFlow, makeMicro, makePerson } from "@/ui/testing/fixtures"
import EntitiesManager from "./EntitiesManager"

/** La liste des acteurs sur une session tenue en état, comme dans l'application ; chaque modification est comptée. */
function afficher(entities: Entity[], relationships: Relationship[] = [], flows: FinancialFlow[] = []) {
  const modifications: SessionState[] = []
  const initiale: SessionState = { ...emptySession(), entities, relationships, annees: [{ annee: 2026, monthlyData: emptySession().annees[0].monthlyData.map(m => (m.month === 0 ? { ...m, flows } : m)) }] }
  function Liste() {
    const [session, setSession] = useState(initiale)
    return (
      <EntitiesManager
        session={session}
        annee={2026}
        setSession={vi.fn((suivante: SessionState) => {
          modifications.push(suivante)
          setSession(suivante)
        })}
      />
    )
  }
  render(<Liste />)
  return { modifications, user: userEvent.setup() }
}

const derniere = (modifications: SessionState[]) => modifications[modifications.length - 1]

describe("changer le statut d'une activité depuis sa fiche", () => {
  const atelier = makeMicro({ beneficieACRE: true })
  const titulaire: Relationship = { id: "r-titulaire", fromId: "person-alice", toId: atelier.id, type: "Titulaire" }
  const chiffre = makeFlow({ id: "ca", entityId: atelier.id, type: "ca_micro_services_bnc", label: "Prestations libérales (BNC)", amount: 3000 })

  async function choisirLeStatut(user: ReturnType<typeof userEvent.setup>, statut: string) {
    await user.click(screen.getAllByRole("button", { name: "Modifier les autres réglages" })[1])
    await user.click(screen.getByRole("combobox", { name: "Statut" }))
    await user.click(await screen.findByRole("option", { name: statut }))
  }

  it("une micro-entreprise devient une EI au réel : ce qui change est dit, puis converti en une seule modification ; la fiche reste ouverte", async () => {
    const { modifications, user } = afficher([makePerson(), atelier], [titulaire], [chiffre])
    // Une modification de la fiche avant la conversion est enregistrée avec elle.
    await user.click(screen.getAllByRole("button", { name: "Modifier les autres réglages" })[1])
    await user.clear(within(screen.getByRole("dialog")).getByLabelText("Nom"))
    await user.type(within(screen.getByRole("dialog")).getByLabelText("Nom"), "Cabinet")
    await user.click(screen.getByRole("combobox", { name: "Statut" }))
    await user.click(await screen.findByRole("option", { name: "Entreprise individuelle (au réel)" }))

    const confirmation = screen.getByRole("dialog", { name: "Passer « Cabinet » en EI au réel ?" })
    const consequences = within(confirmation).getByRole("list", { name: "Ce que la conversion change" })
    expect(consequences).toHaveTextContent("« Prestations libérales (BNC) » (3 000 €) devient « CA - Prestation de services ».")
    expect(consequences).toHaveTextContent("L'ACRE est retirée")
    expect(modifications).toHaveLength(0)
    await user.click(within(confirmation).getByRole("button", { name: "Convertir" }))

    expect(modifications).toHaveLength(1)
    const apres = derniere(modifications)
    expect(apres.entities[1]).toMatchObject({ id: atelier.id, name: "Cabinet", type: "company", legalStatus: "EI" })
    expect(apres.annees[0].monthlyData[0].flows).toEqual([{ ...chiffre, type: "ca_services", label: "CA - Prestation de services" }])
    expect(apres.relationships).toEqual([titulaire])
    const fiche = screen.getByRole("dialog", { name: "Modifier : Cabinet" })
    expect(within(fiche).getByRole("combobox", { name: "Statut" })).toHaveTextContent("Entreprise individuelle (au réel)")
  })

  it("« Annuler » ne change rien : la fiche garde son statut", async () => {
    const { modifications, user } = afficher([makePerson(), atelier], [titulaire], [chiffre])
    await choisirLeStatut(user, "SASU")
    await user.click(within(screen.getByRole("dialog", { name: "Passer « Mon atelier » en SASU ?" })).getByRole("button", { name: "Annuler" }))

    expect(modifications).toHaveLength(0)
    expect(screen.getByRole("combobox", { name: "Statut" })).toHaveTextContent("Micro-entreprise")
  })

  it("une EI qui devient une SASU : le titulaire en devient le président", async () => {
    const ei = makeCompany({ id: "ei", name: "Conseil", legalStatus: "EI", capitalSocial: 0 })
    const { modifications, user } = afficher([makePerson(), ei], [{ id: "r", fromId: "person-alice", toId: "ei", type: "Titulaire" }])
    await choisirLeStatut(user, "SASU")
    const confirmation = screen.getByRole("dialog", { name: "Passer « Conseil » en SASU ?" })
    expect(within(confirmation).getByRole("list")).toHaveTextContent("Alice Martin : « Titulaire » devient « Président ».")
    await user.click(within(confirmation).getByRole("button", { name: "Convertir" }))

    expect(derniere(modifications).relationships).toEqual([{ id: "r", fromId: "person-alice", toId: "ei", type: "Président" }])
    expect(derniere(modifications).entities[1]).toMatchObject({ legalStatus: "SASU", capitalSocial: 1000 })
  })

  it("une EI de masseur-kinésithérapeute ne peut pas devenir une micro-entreprise : la raison, et rien d'autre que « Retour à la fiche »", async () => {
    const kine = makeCompany({ id: "ei", name: "Cabinet", legalStatus: "EI", capitalSocial: 0, profession: "masseur-kinesitherapeute" })
    const { modifications, user } = afficher([makePerson(), kine])
    await choisirLeStatut(user, "Micro-entreprise")

    const refus = screen.getByRole("dialog", { name: "« Cabinet » ne peut pas devenir une micro-entreprise" })
    expect(refus).toHaveAccessibleDescription(/interdite aux praticiens et auxiliaires médicaux/)
    expect(within(refus).queryByRole("button", { name: "Convertir" })).not.toBeInTheDocument()
    await user.click(within(refus).getByRole("button", { name: "Retour à la fiche" }))
    expect(modifications).toHaveLength(0)
  })

  it("une EI qui devient une micro-entreprise : la nature des prestations est demandée", async () => {
    const ei = makeCompany({ id: "ei", name: "Conseil", legalStatus: "EI", capitalSocial: 0 })
    const prestations = makeFlow({ id: "ca", entityId: "ei", type: "ca_services", label: "Missions", amount: 5000 })
    const { modifications, user } = afficher([makePerson(), ei], [{ id: "r", fromId: "person-alice", toId: "ei", type: "Titulaire" }], [prestations])
    await choisirLeStatut(user, "Micro-entreprise")
    const confirmation = screen.getByRole("dialog", { name: "Passer « Conseil » en micro-entreprise ?" })
    expect(within(confirmation).getByRole("radio", { name: "Prestations libérales (BNC)" })).toBeChecked()
    await user.click(within(confirmation).getByRole("radio", { name: "Prestations commerciales ou artisanales (BIC)" }))
    expect(within(confirmation).getByRole("list")).toHaveTextContent("devient « Prestations artisanales ou commerciales (BIC) »")
    await user.click(within(confirmation).getByRole("button", { name: "Convertir" }))

    expect(derniere(modifications).annees[0].monthlyData[0].flows).toEqual([{ ...prestations, type: "ca_micro_services_bic" }])
  })
})
