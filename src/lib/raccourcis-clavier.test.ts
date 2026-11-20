// src/lib/raccourcis-clavier.test.ts

import { describe, expect, it } from "vitest"
import { actionDuRaccourci, demandeLeZoomNormal, estUnMac, saisieDeTexte, type Touche } from "./raccourcis-clavier"

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

describe("retour de l'interface à 100 %", () => {
  it("Ctrl+0, par le zéro du haut du clavier ou celui du pavé numérique", () => {
    expect(demandeLeZoomNormal(touche("0", { ctrlKey: true, code: "Digit0" }), false)).toBe(true)
    expect(demandeLeZoomNormal(touche("0", { ctrlKey: true, code: "Numpad0" }), false)).toBe(true)
    expect(demandeLeZoomNormal(touche("0", { ctrlKey: true }), false)).toBe(true)
  })

  it("en AZERTY, le zéro du haut écrit « à » sans Maj : c'est la touche physique qui compte", () => {
    expect(demandeLeZoomNormal(touche("à", { ctrlKey: true, code: "Digit0" }), false)).toBe(true)
    expect(demandeLeZoomNormal(touche("0", { ctrlKey: true, shiftKey: true, code: "Digit0" }), false)).toBe(true)
  })

  it("AltGr+0, qui écrit « @ » et vaut Ctrl+Alt sous Windows, n'est pas le raccourci", () => {
    expect(demandeLeZoomNormal(touche("@", { ctrlKey: true, altKey: true, code: "Digit0" }), false)).toBe(false)
  })

  it("sur Mac, Cmd remplace Ctrl ; sans touche de commande ou avec un autre chiffre, rien", () => {
    expect(demandeLeZoomNormal(touche("0", { metaKey: true, code: "Digit0" }), true)).toBe(true)
    expect(demandeLeZoomNormal(touche("0", { ctrlKey: true, code: "Digit0" }), true)).toBe(false)
    expect(demandeLeZoomNormal(touche("0", { code: "Digit0" }), false)).toBe(false)
    expect(demandeLeZoomNormal(touche("1", { ctrlKey: true, code: "Digit1" }), false)).toBe(false)
  })
})
