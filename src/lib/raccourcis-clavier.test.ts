// src/lib/raccourcis-clavier.test.ts

import { describe, expect, it } from "vitest"
import { actionDuRaccourci, estUnMac, saisieDeTexte, type Touche } from "./raccourcis-clavier"

const touche = (key: string, modificateurs: Partial<Omit<Touche, "key">> = {}): Touche => ({ key, ctrlKey: false, metaKey: false, shiftKey: false, ...modificateurs })

describe("raccourcis d'annulation", () => {
  it("Ctrl+Z annule, Ctrl+Maj+Z et Ctrl+Y rétablissent, hors Mac", () => {
    expect(actionDuRaccourci(touche("z", { ctrlKey: true }), false)).toBe("annuler")
    expect(actionDuRaccourci(touche("Z", { ctrlKey: true, shiftKey: true }), false)).toBe("retablir")
    expect(actionDuRaccourci(touche("y", { ctrlKey: true }), false)).toBe("retablir")
  })

  it("sur Mac, Cmd remplace Ctrl, et Cmd+Y ne rétablit rien", () => {
    expect(actionDuRaccourci(touche("z", { metaKey: true }), true)).toBe("annuler")
    expect(actionDuRaccourci(touche("z", { metaKey: true, shiftKey: true }), true)).toBe("retablir")
    expect(actionDuRaccourci(touche("y", { metaKey: true }), true)).toBeNull()
    expect(actionDuRaccourci(touche("z", { ctrlKey: true }), true)).toBeNull()
  })

  it("sans la touche de commande, ou avec une autre lettre, rien n'est demandé", () => {
    expect(actionDuRaccourci(touche("z"), false)).toBeNull()
    expect(actionDuRaccourci(touche("z", { metaKey: true }), false)).toBeNull()
    expect(actionDuRaccourci(touche("s", { ctrlKey: true }), false)).toBeNull()
  })

  it("reconnaît un Mac, un iPhone ou un iPad à l'identification du navigateur", () => {
    expect(estUnMac("Mozilla/5.0 (Macintosh; Intel Mac OS X 14_5) AppleWebKit/605.1.15")).toBe(true)
    expect(estUnMac("Mozilla/5.0 (iPad; CPU OS 17_5 like Mac OS X)")).toBe(true)
    expect(estUnMac("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36")).toBe(false)
    expect(estUnMac("Mozilla/5.0 (X11; Linux x86_64)")).toBe(false)
  })
})

describe("saisie de texte : le raccourci appartient au champ", () => {
  it("zones de texte, champs de saisie et contenu modifiable", () => {
    expect(saisieDeTexte({ tagName: "TEXTAREA" })).toBe(true)
    expect(saisieDeTexte({ tagName: "INPUT", type: "text" })).toBe(true)
    expect(saisieDeTexte({ tagName: "input", type: "search" })).toBe(true)
    expect(saisieDeTexte({ tagName: "INPUT" })).toBe(true)
    expect(saisieDeTexte({ tagName: "DIV", isContentEditable: true })).toBe(true)
  })

  it("pas les cases à cocher, boutons, sélecteurs de couleur ni le reste de la page", () => {
    expect(saisieDeTexte({ tagName: "INPUT", type: "checkbox" })).toBe(false)
    expect(saisieDeTexte({ tagName: "INPUT", type: "color" })).toBe(false)
    expect(saisieDeTexte({ tagName: "BUTTON" })).toBe(false)
    expect(saisieDeTexte({ tagName: "BODY", isContentEditable: false })).toBe(false)
    expect(saisieDeTexte({})).toBe(false)
    expect(saisieDeTexte(null)).toBe(false)
  })
})
