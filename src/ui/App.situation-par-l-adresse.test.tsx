// src/ui/App.situation-par-l-adresse.test.tsx
// L'adresse #situation=<identifiant> dans l'application entière (démo web) : la situation type se charge directement
// sur une simulation vide ou sur l'exemple, après la confirmation de la fenêtre des situations types sur une
// simulation non enregistrée ; elle s'annule en une étape ; le fragment est retiré une fois lu ; un identifiant inconnu
// donne un message discret. L'application de bureau ne lit pas cette adresse.

import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"
import type { SessionState } from "@/types"
import { emptySession, makeMicro, makePerson } from "@/ui/testing/fixtures"
import { delaiDesTestsDIntegration } from "@/ui/testing/delais"
import { PLATEFORME_DE_BUREAU, PlateformeContext, type Plateforme } from "./plateforme"
import App from "./App"

// L'application entière, pilotée comme par un utilisateur : un délai plus long, expliqué dans testing/delais.ts.
delaiDesTestsDIntegration()

const UNION_LIBRE = "Couple en union libre, puis marié ou pacsé"
const EXEMPLE: SessionState = { ...emptySession(), name: "Exemple du premier lancement", entities: [makePerson({ name: "Camille" }), makeMicro()] }
const BROUILLON: SessionState = { ...emptySession(), name: "Mon brouillon", entities: [makePerson({ name: "Bob" })] }
const DEMO: Plateforme = { ...PLATEFORME_DE_BUREAU, web: true, estLaSessionDExemple: session => session.name === EXEMPLE.name, lienVersUneSituation: identifiant => `https://exemple.fr/#situation=${identifiant}` }

beforeEach(() => window.history.replaceState(null, "", "/"))

/** Ouvre l'application sur cette adresse, une fois la session enregistrée chargée. */
async function ouvrir(adresse: string, session: SessionState, plateforme: Plateforme = DEMO) {
  window.history.replaceState(null, "", adresse)
  vi.mocked(window.api.getCurrentSession).mockResolvedValue(session)
  const user = userEvent.setup({ delay: null })
  render(
    <PlateformeContext value={plateforme}>
      <App />
    </PlateformeContext>
  )
  return user
}

const titre = () => screen.getByRole("heading", { level: 1 })
const annuler = () => screen.getByRole("button", { name: "Annuler" })
const confirmation = () => screen.queryByRole("dialog", { name: "Remplacer la simulation en cours ?" })
const adresse = () => `${window.location.pathname}${window.location.search}${window.location.hash}`

describe("App : adresse d'une situation type (#situation=…)", () => {
  it("sur une simulation vide, charge la situation directement, retire le fragment, et s'annule en une étape", async () => {
    const user = await ouvrir("/demo/#situation=couple-union-libre", emptySession())

    expect(await screen.findByRole("heading", { level: 1, name: UNION_LIBRE })).toBeInTheDocument()
    expect(confirmation()).not.toBeInTheDocument()
    expect(adresse()).toBe("/demo/")
    // La situation chargée, l'encart des questions de départ n'a plus lieu d'être.
    expect(screen.queryByRole("region", { name: "Que voulez-vous savoir ?" })).not.toBeInTheDocument()

    await user.click(annuler())
    expect(titre()).toHaveTextContent(emptySession().name)
    expect(annuler()).toBeDisabled()
  })

  it("sur l'exemple du premier lancement, charge la situation sans confirmation", async () => {
    await ouvrir("/#situation=salarie-et-micro", EXEMPLE)
    expect(await screen.findByRole("heading", { level: 1, name: "Salarié avec une micro-entreprise à côté" })).toBeInTheDocument()
    expect(confirmation()).not.toBeInTheDocument()
  })

  it("sur une simulation non enregistrée, demande la même confirmation que la fenêtre ; « Annuler » ne change rien", async () => {
    const user = await ouvrir("/#situation=couple-union-libre", BROUILLON)

    const fenetre = await screen.findByRole("dialog", { name: "Remplacer la simulation en cours ?" })
    expect(fenetre).toHaveTextContent(`« Mon brouillon » n'est pas enregistrée dans une sauvegarde. La situation « ${UNION_LIBRE} » la remplacera ; le bouton « Annuler » de la barre d'outils la rétablira.`)
    // Le fragment est retiré dès la lecture : un rechargement ne redemandera pas.
    expect(adresse()).toBe("/")

    await user.click(within(fenetre).getByRole("button", { name: "Annuler" }))
    expect(confirmation()).not.toBeInTheDocument()
    expect(titre()).toHaveTextContent("Mon brouillon")
    expect(annuler()).toBeDisabled()
  })

  it("sur une simulation non enregistrée, « Remplacer » charge la situation, annulable en une étape", async () => {
    const user = await ouvrir("/#situation=couple-union-libre", BROUILLON)

    await user.click(within(await screen.findByRole("dialog", { name: "Remplacer la simulation en cours ?" })).getByRole("button", { name: "Remplacer" }))
    expect(await screen.findByRole("heading", { level: 1, name: UNION_LIBRE })).toBeInTheDocument()

    await user.click(annuler())
    expect(titre()).toHaveTextContent("Mon brouillon")
    expect(annuler()).toBeDisabled()
  })

  it("suit l'adresse en cours de route, et rend ensuite le fragment d'avant (la vue affichée)", async () => {
    await ouvrir("/#resultats", emptySession())
    await screen.findByRole("heading", { level: 1, name: emptySession().name })

    window.location.hash = "#situation=micro-bnc-seule"

    expect(await screen.findByRole("heading", { level: 1, name: "Micro-entreprise seule (BNC)" })).toBeInTheDocument()
    expect(adresse()).toBe("/#resultats")
  })

  it("pour un identifiant inconnu, ne change rien et le dit discrètement, avec l'accès aux situations types", async () => {
    const user = await ouvrir("/#situation=inconnue", BROUILLON)

    const message = await screen.findByText(/^Situation introuvable/)
    expect(message).toHaveTextContent("Situation introuvable : le lien « #situation=inconnue » ne correspond à aucune situation type, la simulation en cours n'a pas changé.")
    expect(message.closest("[role=status]")).not.toBeNull()
    expect(confirmation()).not.toBeInTheDocument()
    expect(titre()).toHaveTextContent("Mon brouillon")
    expect(adresse()).toBe("/")

    await user.click(screen.getByRole("button", { name: "Voir les situations types" }))
    expect(screen.getByRole("dialog", { name: "Partir d'une situation type" })).toBeInTheDocument()
    await user.keyboard("{Escape}")

    await user.click(screen.getByRole("button", { name: "Fermer le message" }))
    expect(screen.queryByText(/^Situation introuvable/)).not.toBeInTheDocument()
  })

  it("dans l'application de bureau, ne lit pas l'adresse", async () => {
    await ouvrir("/#situation=couple-union-libre", emptySession(), PLATEFORME_DE_BUREAU)
    await screen.findByRole("heading", { level: 1, name: emptySession().name })
    // Le temps d'un éventuel chargement : rien ne se passe.
    await new Promise(resolve => setTimeout(resolve, 50))
    expect(titre()).toHaveTextContent(emptySession().name)
    expect(adresse()).toBe("/#situation=couple-union-libre")
  })
})
