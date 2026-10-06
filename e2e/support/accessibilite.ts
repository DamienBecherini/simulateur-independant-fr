// e2e/support/accessibilite.ts
// Audit automatique de l'accessibilité avec axe-core, sur les critères WCAG 2.2 niveau A et AA (ceux que reprend
// le RGAA). Partagé par les tests de l'application Electron et ceux de la démo web.

import { expect, type Page } from "@playwright/test"
import { AxeBuilder } from "@axe-core/playwright"

const CRITERES_WCAG = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"]

type Violations = Awaited<ReturnType<AxeBuilder["analyze"]>>["violations"]

/** Une entrée lisible par violation : règle, impact, aide et éléments en cause avec le détail de l'échec. */
function decrire(violations: Violations): string {
  return violations
    .map(v => `[${v.impact}] ${v.id} : ${v.help}\n${v.nodes.map(n => `    ${n.target.join(" ")}\n      ${n.failureSummary?.replace(/\n/g, "\n      ")}`).join("\n")}`)
    .join("\n\n")
}

/** Parties de la page laissées de côté, et règles non vérifiées : chaque usage dit pourquoi. */
export interface ExceptionsDeLAudit {
  exclure?: string[]
  sansLesRegles?: string[]
}

/** Audite la page, ou la partie désignée par un sélecteur, et échoue en listant les violations trouvées. */
export async function auditerAccessibilite(page: Page, etat: string, inclure?: string, { exclure = [], sansLesRegles = [] }: ExceptionsDeLAudit = {}) {
  // Une fenêtre qui apparaît en fondu aurait, pendant l'animation, des contrastes faussés.
  await page.waitForFunction(() => document.getAnimations().every(animation => animation.playState !== "running"))
  // Mode « hérité » : axe s'exécute entièrement dans la page, sans ouvrir l'onglet annexe qui assemble les
  // résultats des iframes, ce qu'Electron ne permet pas. L'interface n'a pas d'iframe : le résultat est le même.
  let constructeur = new AxeBuilder({ page }).withTags(CRITERES_WCAG).setLegacyMode()
  if (inclure) constructeur = constructeur.include(inclure)
  for (const selecteur of exclure) constructeur = constructeur.exclude(selecteur)
  if (sansLesRegles.length > 0) constructeur = constructeur.disableRules(sansLesRegles)
  const { violations } = await constructeur.analyze()
  expect(
    violations.map(v => v.id),
    `Violations d'accessibilité (${etat}) :\n\n${decrire(violations)}`
  ).toEqual([])
}
