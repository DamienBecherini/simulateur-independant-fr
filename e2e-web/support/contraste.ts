// e2e-web/support/contraste.ts
// Contraste réel des textes d'une partie de la page, calculé dans le navigateur : couleur du texte et fond composé
// couche par couche, des éléments empilés sous le texte (couleur de fond de chacun, puis la teinte translucide posée
// en image de fond, comme la bande des lignes alternées). axe-core ne sait pas composer une image de fond : devant une
// case zébrée, il renonce (« à vérifier ») au lieu de signaler un contraste insuffisant.

import type { Locator } from "@playwright/test"

export interface ContrasteDUnTexte {
  texte: string
  couleur: string
  fond: string
  rapport: number
}

/** Contraste de chaque texte visible dans les éléments désignés, chacun amené à l'écran pour être mesuré. */
export function contrastesDesTextes(cases: Locator): Promise<ContrasteDUnTexte[]> {
  return cases.evaluateAll(elements => {
    const toile = document.createElement("canvas")
    toile.width = toile.height = 1
    const contexte = toile.getContext("2d", { willReadFrequently: true })!

    /** Couleur CSS quelconque (oklch, color-mix…) en rouge, vert, bleu, alpha, par la toile. */
    const enRvb = (couleur: string): [number, number, number, number] => {
      contexte.clearRect(0, 0, 1, 1)
      contexte.fillStyle = couleur
      contexte.fillRect(0, 0, 1, 1)
      const [r, v, b, a] = contexte.getImageData(0, 0, 1, 1).data
      return [r, v, b, a / 255]
    }
    /** Couleur unie d'un dégradé à une seule teinte (`linear-gradient(c, c)`), seule image de fond utilisée ici. */
    const teinteDeLImage = (image: string) => {
      const debut = image.indexOf("(")
      if (!image.startsWith("linear-gradient") || debut < 0) return null
      let profondeur = 0
      for (let i = debut + 1; i < image.length; i++) {
        if (image[i] === "(") profondeur++
        else if (image[i] === ")") profondeur--
        else if (image[i] === "," && profondeur === 0) return image.slice(debut + 1, i).trim()
      }
      return null
    }
    const luminance = ([r, v, b]: number[]) => {
      const lin = (c: number) => ((c /= 255) <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)
      return 0.2126 * lin(r) + 0.7152 * lin(v) + 0.0722 * lin(b)
    }
    const composer = (dessous: number[], dessus: [number, number, number, number]) => dessous.map((c, i) => dessus[i] * dessus[3] + c * (1 - dessus[3]))

    /**
     * Fond au centre d'un texte : les éléments empilés à cet endroit, de la page jusqu'au texte. C'est ce qui est
     * réellement dessous, même pour un texte posé hors de son parent (le numéro au-dessus d'une barre).
     */
    const fondSous = (rect: DOMRect) => {
      const pile = document.elementsFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2).reverse()
      let fond = [255, 255, 255]
      for (const e of pile) {
        const style = getComputedStyle(e)
        fond = composer(fond, enRvb(style.backgroundColor))
        const teinte = teinteDeLImage(style.backgroundImage)
        if (teinte) fond = composer(fond, enRvb(teinte))
      }
      return fond
    }

    const resultats = []
    for (const element of elements) {
      const parcours = document.createTreeWalker(element, NodeFilter.SHOW_TEXT)
      for (let noeud = parcours.nextNode(); noeud; noeud = parcours.nextNode()) {
        const parent = noeud.parentElement!
        if (!noeud.textContent!.trim() || parent.getClientRects().length === 0 || parent.closest(".sr-only")) continue
        parent.scrollIntoView({ block: "center", inline: "nearest" })
        const plage = document.createRange()
        plage.selectNodeContents(noeud)
        const style = getComputedStyle(parent)
        const fond = fondSous(plage.getBoundingClientRect())
        const texte = composer(fond, enRvb(style.color))
        const [clair, sombre] = [luminance(texte), luminance(fond)].sort((a, b) => b - a)
        resultats.push({ texte: noeud.textContent!.trim(), couleur: style.color, fond: `rgb(${fond.map(Math.round).join(", ")})`, rapport: Math.round(((clair + 0.05) / (sombre + 0.05)) * 100) / 100 })
      }
    }
    return resultats
  })
}
