// src/ui/impression.test.tsx
// Sous jsdom (fichier .tsx) : ces fonctions agissent sur la page.

import { afterEach, describe, expect, it, vi } from "vitest"
import { attendreFermetureDesFenetres, dateDuDocument, deplierPourImpression, exporterEnPdf, styleDesPages, suivreImpression } from "./impression"

/** Deux sections repliables, la première fermée, la seconde ouverte. */
function deuxSections() {
  document.body.innerHTML = "<details id='fermee'><summary>Notes</summary><p>Texte</p></details><details id='ouverte' open><summary>Valeurs</summary></details>"
  return { fermee: document.getElementById("fermee") as HTMLDetailsElement, ouverte: document.getElementById("ouverte") as HTMLDetailsElement }
}

afterEach(() => {
  document.body.innerHTML = ""
})

describe("deplierPourImpression", () => {
  it("déplie les sections fermées, puis ne replie qu'elles", () => {
    const { fermee, ouverte } = deuxSections()

    const replier = deplierPourImpression()
    expect([fermee.open, ouverte.open]).toEqual([true, true])

    replier()
    expect([fermee.open, ouverte.open]).toEqual([false, true])
  })
})

describe("suivreImpression", () => {
  it("déplie les sections le temps d'une impression, et cesse d'écouter une fois retiré", () => {
    const { fermee } = deuxSections()
    const retirer = suivreImpression()

    window.dispatchEvent(new Event("beforeprint"))
    expect(fermee.open).toBe(true)
    window.dispatchEvent(new Event("afterprint"))
    expect(fermee.open).toBe(false)

    retirer()
    window.dispatchEvent(new Event("beforeprint"))
    expect(fermee.open).toBe(false)
  })

  it("supporte une annonce d'impression répétée sans perdre l'état des sections", () => {
    const { fermee, ouverte } = deuxSections()
    const retirer = suivreImpression()

    window.dispatchEvent(new Event("beforeprint"))
    window.dispatchEvent(new Event("beforeprint"))
    window.dispatchEvent(new Event("afterprint"))
    window.dispatchEvent(new Event("afterprint"))

    expect([fermee.open, ouverte.open]).toEqual([false, true])
    retirer()
  })
})

describe("styleDesPages", () => {
  it("place le nom de la simulation et la date en tête des pages, sauf la première", () => {
    const style = styleDesPages("Famille Martin", "4 octobre 2026")
    expect(style).toContain('@top-left { content: "Famille Martin"; }')
    expect(style).toContain('@top-right { content: "Document du 4 octobre 2026"; }')
    expect(style).toContain("@page :first { @top-left { content: none; }")
  })

  it("échappe les guillemets et les barres obliques inverses du nom", () => {
    expect(styleDesPages('Le "plan" \\ B', "4 octobre 2026")).toContain('content: "Le \\"plan\\" \\\\ B";')
  })
})

describe("dateDuDocument", () => {
  it("écrit la date en toutes lettres", () => {
    expect(dateDuDocument(new Date(2026, 9, 4))).toBe("4 octobre 2026")
  })
})

describe("attendreFermetureDesFenetres", () => {
  it("attend qu'aucune fenêtre ne soit plus affichée", async () => {
    document.body.innerHTML = "<div role='dialog'>Exporter</div>"
    let terminee = false
    const attente = attendreFermetureDesFenetres().then(() => (terminee = true))

    await new Promise(resolve => setTimeout(resolve, 50))
    expect(terminee).toBe(false)
    document.body.innerHTML = ""
    await attente
    expect(terminee).toBe(true)
  })

  it("n'attend pas indéfiniment une fenêtre qui reste affichée", async () => {
    document.body.innerHTML = "<div role='alertdialog'>Confirmer</div>"
    await expect(attendreFermetureDesFenetres(30)).resolves.toBeUndefined()
  })
})

describe("exporterEnPdf", () => {
  it("demande le PDF sous le nom proposé, une fois les fenêtres refermées, et en rend le résultat", async () => {
    document.body.innerHTML = "<div role='dialog'>Exporter</div>"
    vi.mocked(window.api.printToPdf).mockImplementation(async () => document.querySelector("[role='dialog']") === null)

    const resultat = exporterEnPdf("famille-martin-2026.pdf")
    document.body.innerHTML = ""

    await expect(resultat).resolves.toBe(true)
    expect(window.api.printToPdf).toHaveBeenCalledWith("famille-martin-2026.pdf")
  })
})
