// src/components/ui/couches.test.tsx
// Échap ne ferme que la fenêtre du dessus, y compris pendant que Radix enregistre une fenêtre qui vient de s'ouvrir
// (https://github.com/radix-ui/primitives/issues/4143).

import { useState } from "react"
import { describe, expect, it, vi } from "vitest"
import { act, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { Dialog, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from "./dialog"
import { Sheet, SheetContent, SheetDescription, SheetTitle, SheetTrigger } from "./sheet"

/** « Configuration » (un panneau), d'où s'ouvrent les « Mentions légales » (une fenêtre), comme dans l'application. */
function Imbriquees({ surEchapDesMentions }: { surEchapDesMentions?: (evenement: KeyboardEvent) => void }) {
  const [configuration, setConfiguration] = useState(false)
  const [mentions, setMentions] = useState(false)
  return (
    <Sheet open={configuration} onOpenChange={setConfiguration}>
      <SheetTrigger>Paramètres</SheetTrigger>
      <SheetContent>
        <SheetTitle>Configuration</SheetTitle>
        <SheetDescription>Réglages</SheetDescription>
        <Dialog open={mentions} onOpenChange={setMentions}>
          <DialogTrigger>Mentions légales</DialogTrigger>
          <DialogContent onEscapeKeyDown={surEchapDesMentions}>
            <DialogTitle>Mentions légales</DialogTitle>
            <DialogDescription>Éditeur, hébergement</DialogDescription>
            <input aria-label="Champ des mentions" />
          </DialogContent>
        </Dialog>
      </SheetContent>
    </Sheet>
  )
}

/** Une fenêtre seule, non contrôlée. */
function Seule() {
  return (
    <Dialog>
      <DialogTrigger>Réglages</DialogTrigger>
      <DialogContent>
        <DialogTitle>Réglages</DialogTitle>
        <DialogDescription>Réglages de l'activité</DialogDescription>
        <input aria-label="Nom" />
      </DialogContent>
    </Dialog>
  )
}

const echap = (cible: Element) => cible.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true }))

/** Envoie Échap à l'élément choisi dès que Radix annonce l'enregistrement d'une couche, avant qu'elle n'écoute la touche. */
function echapPendantLEnregistrement(cible: () => Element) {
  document.addEventListener("dismissableLayer.update", () => echap(cible()), { once: true })
}

const fenetre = (nom: string) => screen.queryByRole("dialog", { name: nom })
/** « Configuration » reste-t-elle ouverte ? Sous une fenêtre, elle est masquée aux technologies d'assistance. */
const configurationOuverte = () => document.querySelector('[data-slot="sheet-content"][data-state="open"]') !== null

describe("Échap et fenêtres imbriquées", () => {
  it("une fois les fenêtres ouvertes, Échap ferme celle du dessus, puis l'autre, et rend le focus au bouton qui l'a ouverte", async () => {
    render(<Imbriquees />)
    await userEvent.click(screen.getByRole("button", { name: "Paramètres" }))
    await userEvent.click(screen.getByRole("button", { name: "Mentions légales" }))
    expect(fenetre("Mentions légales")).toBeInTheDocument()
    await userEvent.keyboard("{Escape}")
    await waitFor(() => expect(fenetre("Mentions légales")).not.toBeInTheDocument())
    expect(fenetre("Configuration")).toBeInTheDocument()
    await waitFor(() => expect(screen.getByRole("button", { name: "Mentions légales" })).toHaveFocus())
    await userEvent.keyboard("{Escape}")
    await waitFor(() => expect(fenetre("Configuration")).not.toBeInTheDocument())
  })

  it("Échap pendant l'enregistrement de la fenêtre du dessus la ferme, elle seule", async () => {
    render(<Imbriquees />)
    await userEvent.click(screen.getByRole("button", { name: "Paramètres" }))
    echapPendantLEnregistrement(() => screen.getByRole("textbox", { name: "Champ des mentions" }))
    await userEvent.click(screen.getByRole("button", { name: "Mentions légales" }))
    await waitFor(() => expect(fenetre("Mentions légales")).not.toBeInTheDocument())
    expect(configurationOuverte()).toBe(true)
  })

  it("le gestionnaire onEscapeKeyDown de la fenêtre du dessus peut la garder ouverte, sans fermer celle du dessous", async () => {
    const garder = vi.fn((evenement: KeyboardEvent) => evenement.preventDefault())
    render(<Imbriquees surEchapDesMentions={garder} />)
    await userEvent.click(screen.getByRole("button", { name: "Paramètres" }))
    echapPendantLEnregistrement(() => screen.getByRole("textbox", { name: "Champ des mentions" }))
    await userEvent.click(screen.getByRole("button", { name: "Mentions légales" }))
    expect(garder).toHaveBeenCalledTimes(1)
    expect(fenetre("Mentions légales")).toBeInTheDocument()
    expect(configurationOuverte()).toBe(true)
  })

  it("une fenêtre seule se ferme à Échap dès son ouverture", async () => {
    render(<Seule />)
    echapPendantLEnregistrement(() => screen.getByRole("textbox", { name: "Nom" }))
    await userEvent.click(screen.getByRole("button", { name: "Réglages" }))
    await waitFor(() => expect(fenetre("Réglages")).not.toBeInTheDocument())
    await waitFor(() => expect(screen.getByRole("button", { name: "Réglages" })).toHaveFocus())
  })

  it("Échap visant une autre couche (une liste ouverte par-dessus) ne ferme pas la fenêtre", async () => {
    render(<Seule />)
    await userEvent.click(screen.getByRole("button", { name: "Réglages" }))
    const liste = document.createElement("div")
    liste.dataset.slot = "select-content"
    const option = document.createElement("button")
    liste.append(option)
    document.body.append(liste)
    act(() => {
      echap(option)
    })
    expect(fenetre("Réglages")).toBeInTheDocument()
    liste.remove()
  })
})
