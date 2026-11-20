// src/ui/components/NotesDuComparateur.test.tsx
// Les notes du tableau de comparaison : la bulle ouverte par une pastille du tableau, et, sous le tableau, la liste
// complète ou, dans l'affichage « Résumé », les notes du statut actuel suivies d'une ligne de pastilles.

import { describe, expect, it } from "vitest"
import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import type { Note } from "@/lib/notes"
import type { Affichage } from "@/types"
import { AffichageContext } from "../hooks/useAffichage"
import { BullesDesNotes, NotesDuTableau, RenvoisAuxNotes } from "./NotesDuComparateur"

// La SASU est le statut actuel : sa note parle de la situation réelle.
const NOTES: Note[] = [
  { numero: 1, texte: "TVA due au-delà du seuil.", colonnes: ["Micro-entreprise", "Micro + versement libératoire"], duStatutActuel: false },
  { numero: 2, texte: "Seuil du versement libératoire à vérifier.", colonnes: ["Micro + versement libératoire"], duStatutActuel: false },
  { numero: 3, texte: "La société est déficitaire.", colonnes: ["SASU"], duStatutActuel: true }
]
const TEXTES = ["1Note 1. Micro-entreprise, Micro + versement libératoire : TVA due au-delà du seuil.", "2Note 2. Micro + versement libératoire : Seuil du versement libératoire à vérifier.", "3Note 3. SASU : La société est déficitaire."]

/** Deux colonnes du tableau avec leurs pastilles, et les notes dessous, dans l'affichage demandé. */
function afficher(affichage: Affichage = "classique", notes = NOTES) {
  render(
    <AffichageContext.Provider value={affichage}>
      <BullesDesNotes notes={notes}>
        <div data-testid="micro">
          <RenvoisAuxNotes colonne="micro" renvois={[1]} />
        </div>
        <div data-testid="micro-vfl">
          <RenvoisAuxNotes colonne="micro-vfl" renvois={[1, 2]} />
        </div>
        <div data-testid="eurl">
          <RenvoisAuxNotes colonne="EURL" renvois={[]} />
        </div>
      </BullesDesNotes>
      <NotesDuTableau notes={notes} activityName="Mon atelier" />
      <button type="button">Ailleurs</button>
    </AffichageContext.Provider>
  )
  const pastille = (colonne: string, numero: number) => within(screen.getByTestId(colonne)).getByRole("button", { name: `Voir la note ${numero}` })
  return { user: userEvent.setup(), pastille }
}

describe("bulle d'une pastille du tableau", () => {
  it("s'ouvre au clic avec la note, et se referme d'un second clic", async () => {
    const { user, pastille } = afficher()
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument()
    expect(screen.getByTestId("eurl")).toBeEmptyDOMElement()
    expect(pastille("micro", 1)).toHaveAttribute("aria-expanded", "false")

    await user.click(pastille("micro", 1))
    const bulle = screen.getByRole("tooltip")
    expect(bulle).toHaveTextContent("Note 1. Micro-entreprise, Micro + versement libératoire : TVA due au-delà du seuil.")
    expect(pastille("micro", 1)).toHaveAttribute("aria-expanded", "true")
    expect(pastille("micro", 1)).toHaveAttribute("aria-describedby", bulle.id)
    // La même note a une pastille par colonne : seule celle qui a ouvert la bulle est marquée.
    expect(pastille("micro-vfl", 1)).toHaveAttribute("aria-expanded", "false")
    // Un lecteur d'écran entend la note dans la zone d'annonce.
    expect(screen.getByRole("status")).toHaveTextContent("Note 1. Micro-entreprise, Micro + versement libératoire : TVA due au-delà du seuil.")

    await user.click(pastille("micro", 1))
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument()
    expect(screen.getByRole("status")).toBeEmptyDOMElement()
  })

  it("se ferme d'un clic ailleurs, et à Échap en rendant le focus à sa pastille", async () => {
    const { user, pastille } = afficher()
    await user.click(pastille("micro-vfl", 2))
    expect(screen.getByRole("tooltip")).toHaveTextContent("Note 2.")
    await user.click(screen.getByRole("button", { name: "Ailleurs" }))
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument()

    await user.click(pastille("micro-vfl", 2))
    // Un clic dans la bulle (sélectionner son texte) ne la ferme pas.
    await user.click(screen.getByRole("tooltip"))
    expect(screen.getByRole("tooltip")).toBeInTheDocument()
    await user.keyboard("{Escape}")
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument()
    expect(pastille("micro-vfl", 2)).toHaveFocus()
  })

  it("une seule bulle à la fois : une autre pastille remplace la note affichée", async () => {
    const { user, pastille } = afficher()
    await user.click(pastille("micro", 1))
    await user.click(pastille("micro-vfl", 2))
    expect(screen.getAllByRole("tooltip")).toHaveLength(1)
    expect(screen.getByRole("tooltip")).toHaveTextContent("Note 2. Micro + versement libératoire : Seuil du versement libératoire à vérifier.")
    expect(pastille("micro", 1)).toHaveAttribute("aria-expanded", "false")
  })

  it("s'ouvre au clavier, la pastille étant un bouton", async () => {
    const { user, pastille } = afficher()
    pastille("micro", 1).focus()
    await user.keyboard("{Enter}")
    expect(screen.getByRole("tooltip")).toHaveTextContent("Note 1.")
    expect(pastille("micro", 1)).toHaveFocus()
  })

  it("faire défiler la page ou le tableau ne ferme pas la bulle ; un changement de taille de la fenêtre la ferme", async () => {
    const { user, pastille } = afficher()
    await user.click(pastille("micro", 1))
    // Posée dans la page, la bulle défile avec elle ; le tableau qui défile de côté la fait seulement se replacer.
    document.dispatchEvent(new Event("scroll"))
    screen.getByTestId("micro").dispatchEvent(new Event("scroll"))
    expect(screen.getByRole("tooltip")).toBeInTheDocument()
    window.dispatchEvent(new Event("resize"))
    await screen.findByText("Ailleurs")
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument()
  })
})

describe("notes sous le tableau", () => {
  const ligne = () => screen.getByRole("group", { name: "Notes des autres statuts" })
  /** Les listes de notes à l'écran : celle des notes écrites, et, quand elles sont réduites, celle de l'impression. */
  const listes = () => screen.getAllByRole("list")
  const textesDe = (liste: HTMLElement) => within(liste).getAllByRole("listitem").map(note => note.textContent)

  it("affichage « Classique » : la liste complète, sans rien à déplier", () => {
    afficher("classique")
    expect(screen.getByText("Notes sur « Mon atelier »")).toBeInTheDocument()
    expect(listes()).toHaveLength(1)
    expect(textesDe(listes()[0])).toEqual(TEXTES)
    expect(document.getElementById("note-comparateur-2")).toHaveTextContent("Seuil du versement libératoire à vérifier.")
    expect(screen.queryByRole("group", { name: "Notes des autres statuts" })).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: /Tout afficher/ })).not.toBeInTheDocument()
  })

  it("affichage « Résumé » : la note du statut actuel reste écrite, les autres tiennent en une ligne de pastilles", async () => {
    const { user } = afficher("resume")
    const [ecrites, impression] = listes()
    // La note de la SASU, statut actuel, parle de la situation réelle : elle n'attend pas un clic.
    expect(textesDe(ecrites)).toEqual([TEXTES[2]])
    expect(ecrites).toHaveClass("print:hidden")
    expect(screen.getByText("Autres statuts :")).toBeInTheDocument()
    expect(within(ligne()).getAllByRole("button").map(bouton => bouton.getAttribute("aria-label"))).toEqual(["Note 1 : Micro-entreprise, Micro + versement libératoire", "Note 2 : Micro + versement libératoire"])
    expect(screen.getByText("Un clic sur un numéro, ici ou dans le tableau, affiche la note.")).toBeInTheDocument()
    // La liste complète n'est là que pour l'impression : elle seule porte les identifiants des notes.
    expect(impression).toHaveClass("hidden", "print:block")
    expect(textesDe(impression)).toEqual(TEXTES)
    expect(document.querySelectorAll('[id^="note-comparateur-"]')).toHaveLength(3)

    const note2 = within(ligne()).getByRole("button", { name: /^Note 2/ })
    await user.click(note2)
    expect(note2).toHaveAttribute("aria-pressed", "true")
    expect(within(ligne()).getByRole("button", { name: /^Note 1/ })).toHaveAttribute("aria-pressed", "false")
    const affichee = document.querySelector('[aria-live="polite"]') as HTMLElement
    expect(affichee).toHaveTextContent(TEXTES[1])

    await user.click(within(ligne()).getByRole("button", { name: /^Note 1/ }))
    expect(affichee).toHaveTextContent(TEXTES[0])
    expect(affichee).not.toHaveTextContent("Seuil du versement")
    // Un second clic sur la pastille choisie replie sa note.
    await user.click(within(ligne()).getByRole("button", { name: /^Note 1/ }))
    expect(affichee).toHaveTextContent("Un clic sur un numéro")
  })

  it("« Tout afficher » rend la liste complète, puis « Réduire les notes des autres statuts » revient à la ligne de pastilles", async () => {
    const { user } = afficher("resume")
    await user.click(screen.getByRole("button", { name: "Tout afficher (3)" }))
    expect(screen.queryByRole("group", { name: "Notes des autres statuts" })).not.toBeInTheDocument()
    expect(listes()).toHaveLength(1)
    expect(textesDe(listes()[0])).toEqual(TEXTES)
    expect(listes()[0]).not.toHaveClass("hidden")
    await user.click(screen.getByRole("button", { name: "Réduire les notes des autres statuts" }))
    expect(ligne()).toBeInTheDocument()
  })

  it("sans note du statut actuel, la ligne de pastilles n'a pas de titre", () => {
    afficher("resume", NOTES.slice(0, 2))
    expect(screen.queryByText("Autres statuts :")).not.toBeInTheDocument()
    expect(within(ligne()).getAllByRole("button")).toHaveLength(2)
  })

  it("rien à réduire avec une seule note d'un autre statut, ou des notes du seul statut actuel : la liste complète, même en « Résumé »", () => {
    for (const notes of [NOTES.slice(1), [NOTES[2], { ...NOTES[0], duStatutActuel: true }]]) {
      const { unmount } = render(
        <AffichageContext.Provider value="resume">
          <NotesDuTableau notes={notes} activityName="Mon atelier" />
        </AffichageContext.Provider>
      )
      expect(screen.getAllByRole("listitem")).toHaveLength(2)
      expect(screen.queryByRole("button")).not.toBeInTheDocument()
      unmount()
    }
    const { container } = render(<NotesDuTableau notes={[]} activityName="Mon atelier" />)
    expect(container).toBeEmptyDOMElement()
  })
})
