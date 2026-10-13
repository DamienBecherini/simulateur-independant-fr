// src/ui/App.ancres.test.tsx
// Les ancres du registre (src/lib/ancres.ts) dans l'application entière, calculée par le vrai moteur : chacune est
// rendue par un élément de la page, et chaque lien de la barre de résumé mène à une ancre présente, dans la vue que
// lui donne la table des vues (affichage « Trois vues »). Une ancre ajoutée au registre sans élément qui la porte, ou un
// lien vers une ancre que plus rien ne rend, fait échouer ce test.

import { render, screen, within } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import type { Affichage, SessionState } from "@/types"
import { calculsDuPont } from "@/backend/logic/calculs-du-pont"
import { ANCRES, estUneAncre, type Ancre } from "@/lib/ancres"
import { MONTAGES_TYPES, sessionDUnMontage } from "@/lib/montages/montages"
import { destinationDeLAdresse } from "@/lib/vues"
import { delaiDesTestsDIntegration } from "@/ui/testing/delais"
import App from "./App"

// L'application entière et le vrai moteur : un délai plus long, expliqué dans testing/delais.ts.
delaiDesTestsDIntegration()

/** Les calculs de `window.api` faits par le moteur, comme dans la démo web. */
function avecLeMoteur() {
  vi.mocked(window.api.simulerLesAnnees).mockImplementation(async session => calculsDuPont.simulerLesAnnees(session))
  vi.mocked(window.api.compareStatuts).mockImplementation(async (session, options, annee) => calculsDuPont.compareStatuts(session, options, annee))
  vi.mocked(window.api.optimiserRemuneration).mockImplementation(async (session, options, statut, annee) => calculsDuPont.optimiserRemuneration(session, options, statut, annee))
  vi.mocked(window.api.comparerStrategies).mockImplementation(async (session, activite) => calculsDuPont.comparerStrategies(session, activite))
}

function situation(id: string): SessionState {
  const montage = MONTAGES_TYPES.find(m => m.id === id)
  if (!montage) throw new Error(`Situation type inconnue : ${id}`)
  return sessionDUnMontage(montage)
}

/**
 * Deux situations qui, à elles deux, font paraître toutes les réponses de la barre : le couple en union libre (mariage
 * ou Pacs) et la SASU (rémunération optimale) ; chacune attend le lien de sa réponse, arrivé après le calcul.
 */
const SITUATIONS = [
  { id: "couple-union-libre", reponse: /^Mariage ou Pacs/ },
  { id: "sasu-salaire-4-trimestres", reponse: /^Rémunération optimale/ }
]

/** Monte l'application sur la situation et attend la réponse dans la barre ; rend les liens de la barre. */
async function liensDeLaBarre(id: string, reponse: RegExp, affichage: Affichage) {
  avecLeMoteur()
  vi.mocked(window.api.getCurrentSession).mockResolvedValue(situation(id))
  vi.mocked(window.api.getUserPreferences).mockResolvedValue({ slotOrder: [], affichage })
  const { unmount } = render(<App />)
  const barre = await screen.findByRole("region", { name: "Résumé de l'année" })
  await within(barre).findByRole("link", { name: reponse }, { timeout: 5000 })
  return { liens: within(barre).getAllByRole("link"), demonter: unmount }
}

/** Ancres rendues par la page : les éléments dont l'identifiant est une ancre du registre. */
const ancresRendues = (): Ancre[] => Object.values(ANCRES).filter(ancre => document.getElementById(ancre) !== null)

describe("App : ancres de la page", () => {
  for (const affichage of ["resume", "vues"] as const) {
    it(`affichage « ${affichage} » : chaque ancre du registre est rendue, et chaque lien de la barre mène à une ancre présente, dans sa vue`, async () => {
      const rendues = new Set<Ancre>()
      for (const { id, reponse } of SITUATIONS) {
        const { liens, demonter } = await liensDeLaBarre(id, reponse, affichage)
        for (const lien of liens) {
          const cible = lien.getAttribute("href")?.replace(/^#/, "") ?? ""
          expect(estUneAncre(cible), `lien « ${lien.textContent} » vers ${cible}`).toBe(true)
          const element = document.getElementById(cible)
          expect(element, `ancre ${cible} absente de la page`).not.toBeNull()
          if (affichage === "vues") {
            // La vue que la table annonce est celle qui contient vraiment l'élément.
            const vue = destinationDeLAdresse(`#${cible}`, () => null)?.vue
            expect(element!.closest<HTMLElement>("[data-vue]")?.dataset.vue, `vue de ${cible}`).toBe(vue)
          }
        }
        for (const ancre of ancresRendues()) rendues.add(ancre)
        // Chaque situation dans une page neuve.
        demonter()
      }
      expect([...rendues].sort()).toEqual(Object.values(ANCRES).sort())
    })
  }
})
