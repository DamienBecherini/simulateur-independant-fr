// e2e-web/lignes-de-flux.web.ts
// Les lignes de la saisie mensuelle, à toutes les largeurs : le libellé garde de quoi lire son texte indicatif, et aucun
// champ ne sort de sa ligne. Une ligne de salaire porte deux champs de plus (brut, part du net) : avec le seuil commun
// d'origine, son libellé tombait à 0 px entre 560 et 760 px de large, et ses champs débordaient (voir ligne-de-flux.ts).

import { test, expect, type Page } from "@playwright/test"

const SESSION = {
  formatVersion: 3,
  name: "Lignes de flux",
  entities: [
    { id: "person-alice", type: "person", name: "Alice Martin", fiscalParts: 1, avatar: { type: "initials", value: "AM", color: "#3b82f6" }, locked: false },
    { id: "company-atelier", type: "company", name: "Atelier", legalStatus: "SASU", capitalSocial: 1000, avatar: { type: "icon", value: "Store", color: "#d97706" }, locked: false }
  ],
  relationships: [{ id: "r-president", fromId: "person-alice", toId: "company-atelier", type: "Président" }],
  annees: [
    {
      annee: 2026,
      monthlyData: Array.from({ length: 12 }, (_, month) => ({
        month,
        // Libellés par défaut : les champs sont vides et montrent leur texte indicatif.
        flows: month === 0 ? [{ id: "ca", entityId: "company-atelier", type: "ca_services", label: "", amount: 80000 }, { id: "salaire", entityId: "person-alice", type: "salary", label: "", amount: 2000 }] : []
      }))
    }
  ]
}

/** Largeurs de fenêtre : de l'écran large au téléphone, en passant par la plage où le libellé d'un salaire disparaissait. */
const LARGEURS = [1280, 920, 840, 760, 680, 640, 560, 400, 320]
const ZOOMS = [1, 1.5]

interface Releve {
  ligne: string
  /** Place du texte dans le champ du libellé, et place que demande son texte indicatif, en pixels CSS. */
  place: number
  besoin: number
  /** Éléments de la ligne qui dépassent son bord droit. */
  sortis: number
}

/** Chaque ligne de la fenêtre de saisie ouverte : la place du libellé et ce qui sort de la ligne. */
function releverLesLignes(page: Page): Promise<Releve[]> {
  return page.getByRole("dialog").evaluate(fenetre => {
    const toile = document.createElement("canvas").getContext("2d")!
    return Array.from(fenetre.querySelectorAll<HTMLInputElement>('input[placeholder="Libellé"]')).map(champ => {
      const style = getComputedStyle(champ)
      toile.font = `${style.fontSize} ${style.fontFamily}`
      const ligne = champ.parentElement!
      const bord = ligne.getBoundingClientRect().right
      return {
        ligne: `${ligne.querySelector('[aria-label="Réordonner le flux"]') ? "existante" : "nouvelle"}, ${ligne.querySelectorAll("input").length} champs`,
        place: Math.floor(champ.clientWidth - Number.parseFloat(style.paddingLeft) - Number.parseFloat(style.paddingRight)),
        besoin: Math.ceil(toile.measureText(champ.placeholder).width),
        sortis: Array.from(ligne.children).filter(enfant => enfant.getBoundingClientRect().right > bord + 1).length
      }
    })
  })
}

for (const zoom of ZOOMS) {
  test(`lignes de flux à ${zoom * 100} % : le libellé reste lisible et rien ne sort de la ligne, de 1 280 à 320 px`, async ({ page }) => {
    await page.addInitScript(
      ([session, z]) => {
        window.localStorage.setItem("simulateur.session", JSON.stringify(session))
        window.localStorage.setItem("simulateur.preferences", JSON.stringify({ slotOrder: [], affichage: "classique", zoom: z }))
      },
      [SESSION, zoom] as const
    )
    const defauts: string[] = []
    let lignesDeSalaire = 0
    for (const largeur of LARGEURS) {
      await page.setViewportSize({ width: largeur, height: 900 })
      await page.goto("./")
      for (const acteur of ["Alice Martin", "Atelier"]) {
        await page.getByRole("button", { name: `Flux de janvier : ${acteur}` }).click()
        const fenetre = page.getByRole("dialog", { name: new RegExp(`^Opérations de .* / ${acteur}$`) })
        await expect(fenetre).toBeVisible()
        const releves = await releverLesLignes(page)
        // La ligne existante et la ligne vide qui en ajoute une.
        expect(releves, `${acteur}, ${largeur} px`).toHaveLength(2)
        lignesDeSalaire += releves.filter(r => r.ligne === "existante, 4 champs").length
        for (const r of releves) {
          if (r.place < r.besoin) defauts.push(`${largeur} px, ${acteur}, ligne ${r.ligne} : ${r.place} px pour un texte de ${r.besoin} px`)
          if (r.sortis > 0) defauts.push(`${largeur} px, ${acteur}, ligne ${r.ligne} : ${r.sortis} élément(s) hors de la ligne`)
        }
        await page.keyboard.press("Escape")
        await expect(fenetre).toBeHidden()
      }
    }
    // Le salaire d'Alice est bien mesuré à chaque largeur : c'est la ligne la plus chargée.
    expect(lignesDeSalaire).toBe(LARGEURS.length)
    expect(defauts, defauts.join("\n")).toEqual([])
  })
}
