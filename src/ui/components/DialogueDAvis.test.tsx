// src/ui/components/DialogueDAvis.test.tsx
// Fenêtre « Donner mon avis » : tout est facultatif mais l'envoi attend une information, l'aperçu montre le texte
// envoyé, les deux envois ouvrent la bonne adresse, la copie est confirmée, et le clavier suffit.

import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { useRef, useState } from "react"
import { describe, expect, it, vi } from "vitest"
import { ADRESSE_E_MAIL_DES_RETOURS, ADRESSE_NOUVEAU_TICKET } from "@/lib/adresses-des-retours"
import { CONDITION_D_ENVOI, type Diagnostic } from "@/lib/retours"
import { DialogueDAvis } from "./DialogueDAvis"

const DIAGNOSTIC: Diagnostic = { version: "0.9.0", web: true, systeme: "Windows", navigateur: "Chrome 140", affichageEnCours: "classique", nombreDAnnees: 2, nombreDActeurs: 3 }

/** La fenêtre et le bouton qui l'ouvre, comme dans la barre d'outils. */
function AvecBouton() {
  const [ouvert, setOuvert] = useState(false)
  const declencheur = useRef<HTMLButtonElement>(null)
  return (
    <>
      <button ref={declencheur} type="button" onClick={() => setOuvert(true)}>
        Donner mon avis
      </button>
      <DialogueDAvis isOpen={ouvert} onClose={() => setOuvert(false)} diagnostic={DIAGNOSTIC} declencheur={declencheur} />
    </>
  )
}

async function ouvrir() {
  const user = userEvent.setup()
  render(<AvecBouton />)
  await user.click(screen.getByRole("button", { name: "Donner mon avis" }))
  return { user, fenetre: await screen.findByRole("dialog", { name: "Donner mon avis" }) }
}

const boutons = (fenetre: HTMLElement) => ({
  gitHub: within(fenetre).getByRole("button", { name: "Envoyer sur GitHub (compte requis, message public)" }),
  eMail: within(fenetre).getByRole("button", { name: "Envoyer par e-mail" }),
  copier: within(fenetre).getByRole("button", { name: "Copier le message" })
})
const apercu = (fenetre: HTMLElement) => within(fenetre).getByLabelText("Texte envoyé")

describe("fenêtre « Donner mon avis »", () => {
  it("ne choisit rien d'office, et attend une information pour envoyer, en disant laquelle", async () => {
    const { fenetre } = await ouvrir()
    for (const radio of within(fenetre).getAllByRole("radio")) expect(radio).not.toBeChecked()
    expect(within(fenetre).getByRole("checkbox", { name: "Joindre un diagnostic" })).not.toBeChecked()
    for (const bouton of Object.values(boutons(fenetre))) {
      expect(bouton).toBeDisabled()
      expect(bouton).toHaveAccessibleDescription(CONDITION_D_ENVOI)
    }
    // La version et la cible sont toujours jointes ; rien d'autre tant que rien n'est choisi.
    expect(apercu(fenetre).textContent).toBe("Version : 0.9.0\nEnvironnement : démo web")
  })

  it.each([
    ["une note", (f: HTMLElement) => within(f).getByRole("radio", { name: "4 sur 5" })],
    ["un affichage", (f: HTMLElement) => within(f).getByRole("radio", { name: "Trois vues" })],
    ["un type", (f: HTMLElement) => within(f).getByRole("radio", { name: "Bug" })]
  ])("s'active avec %s seul", async (_cas, choix) => {
    const { user, fenetre } = await ouvrir()
    await user.click(choix(fenetre))
    for (const bouton of Object.values(boutons(fenetre))) expect(bouton).toBeEnabled()
    expect(within(fenetre).queryByText(CONDITION_D_ENVOI)).not.toBeInTheDocument()
  })

  it("s'active avec un message, pas avec des espaces ni avec le diagnostic seul", async () => {
    const { user, fenetre } = await ouvrir()
    await user.click(within(fenetre).getByRole("checkbox", { name: "Joindre un diagnostic" }))
    await user.type(within(fenetre).getByRole("textbox", { name: "Message" }), "   ")
    expect(boutons(fenetre).gitHub).toBeDisabled()
    await user.type(within(fenetre).getByRole("textbox", { name: "Message" }), "Bravo")
    expect(boutons(fenetre).gitHub).toBeEnabled()
  })

  it("montre dans l'aperçu exactement le texte envoyé, diagnostic sans donnée de la simulation", async () => {
    const { user, fenetre } = await ouvrir()
    await user.click(within(fenetre).getByRole("radio", { name: "5 sur 5" }))
    await user.click(within(fenetre).getByRole("radio", { name: "Résumé" }))
    await user.click(within(fenetre).getByRole("radio", { name: "Idée" }))
    await user.type(within(fenetre).getByRole("textbox", { name: "Message" }), "Un export Excel")
    await user.click(within(fenetre).getByRole("checkbox", { name: "Joindre un diagnostic" }))

    expect(apercu(fenetre).textContent).toBe(
      "Note : ★★★★★ 5/5\nAffichage préféré : Résumé\nType de retour : Idée\n\nMessage :\nUn export Excel\n\nVersion : 0.9.0\nEnvironnement : démo web · Windows · Chrome 140\n\nDiagnostic :\nAffichage en cours : Classique\nAnnées simulées : 2\nActeurs : 3"
    )
  })

  it("ouvre le ticket GitHub prérempli, puis l'e-mail, et le dit", async () => {
    const { user, fenetre } = await ouvrir()
    await user.click(within(fenetre).getByRole("radio", { name: "3 sur 5" }))
    await user.click(boutons(fenetre).gitHub)

    const [adresseDuTicket] = vi.mocked(window.api.ouvrirAdresseExterne).mock.calls[0]
    expect(adresseDuTicket.startsWith(`${ADRESSE_NOUVEAU_TICKET}?template=retour.yml&`)).toBe(true)
    expect(new URL(adresseDuTicket).searchParams.get("note")).toBe("★★★☆☆ 3/5")
    expect(await within(fenetre).findByRole("status")).toHaveTextContent("Le formulaire GitHub s'ouvre dans votre navigateur")

    await user.click(boutons(fenetre).eMail)
    const [adresseDeLEMail] = vi.mocked(window.api.ouvrirAdresseExterne).mock.calls[1]
    expect(adresseDeLEMail.startsWith(`mailto:${ADRESSE_E_MAIL_DES_RETOURS}?subject=`)).toBe(true)
    expect(within(fenetre).getByRole("status")).toHaveTextContent("Votre messagerie s'ouvre")
  })

  it("dit quand l'adresse n'a pas pu être ouverte", async () => {
    vi.mocked(window.api.ouvrirAdresseExterne).mockResolvedValueOnce(false)
    const { user, fenetre } = await ouvrir()
    await user.click(within(fenetre).getByRole("radio", { name: "Bug" }))
    await user.click(boutons(fenetre).gitHub)
    expect(await within(fenetre).findByRole("status")).toHaveTextContent("L'adresse n'a pas pu être ouverte")
  })

  it("copie l'adresse et le message, et le confirme", async () => {
    const { user, fenetre } = await ouvrir()
    const ecrire = vi.spyOn(navigator.clipboard, "writeText")
    await user.click(within(fenetre).getByRole("radio", { name: "Avis" }))
    await user.click(boutons(fenetre).copier)
    expect(ecrire).toHaveBeenCalledWith(`À : ${ADRESSE_E_MAIL_DES_RETOURS}\nSujet : Retour sur le simulateur — v0.9.0\n\nType de retour : Avis\n\nVersion : 0.9.0\nEnvironnement : démo web`)
    expect(await within(fenetre).findByRole("status")).toHaveTextContent("Adresse et message copiés")
  })

  it("dit quand la copie échoue", async () => {
    const { user, fenetre } = await ouvrir()
    vi.spyOn(navigator.clipboard, "writeText").mockRejectedValueOnce(new Error("refusé"))
    await user.click(within(fenetre).getByRole("radio", { name: "Avis" }))
    await user.click(boutons(fenetre).copier)
    expect(await within(fenetre).findByRole("status")).toHaveTextContent("La copie a échoué")
  })

  it("prévient que le ticket est public et que l'adresse e-mail est visible", async () => {
    const { fenetre } = await ouvrir()
    expect(fenetre).toHaveTextContent("Votre message sera public sur GitHub : n'y mettez pas d'informations personnelles.")
    expect(fenetre).toHaveTextContent("Votre adresse e-mail sera visible par le destinataire ; elle ne sert qu'à vous répondre.")
    expect(fenetre).toHaveTextContent("Les avis reçus par e-mail ne comptent pas dans la note moyenne publiée.")
  })

  it("se remplit au clavier : flèches dans les choix, « Effacer la note » rend le focus au groupe", async () => {
    const { user, fenetre } = await ouvrir()
    within(fenetre).getByRole("radio", { name: "1 sur 5" }).focus()
    await user.keyboard("{ArrowRight}{ArrowRight}")
    expect(within(fenetre).getByRole("radio", { name: "3 sur 5" })).toBeChecked()
    expect(boutons(fenetre).gitHub).toBeEnabled()

    await user.click(within(fenetre).getByRole("button", { name: "Effacer la note" }))
    for (const radio of within(fenetre).getAllByRole("radio")) expect(radio).not.toBeChecked()
    expect(within(fenetre).getByRole("radio", { name: "1 sur 5" })).toHaveFocus()
    expect(within(fenetre).queryByRole("button", { name: "Effacer la note" })).not.toBeInTheDocument()
    expect(boutons(fenetre).gitHub).toBeDisabled()
  })

  it("se ferme avec Échap, rend le focus au bouton qui l'a ouverte, et garde le brouillon", async () => {
    const { user, fenetre } = await ouvrir()
    await user.type(within(fenetre).getByRole("textbox", { name: "Message" }), "Brouillon")
    await user.keyboard("{Escape}")
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
    await vi.waitFor(() => expect(screen.getByRole("button", { name: "Donner mon avis" })).toHaveFocus())

    await user.click(screen.getByRole("button", { name: "Donner mon avis" }))
    expect(within(await screen.findByRole("dialog")).getByRole("textbox", { name: "Message" })).toHaveValue("Brouillon")
  })
})
