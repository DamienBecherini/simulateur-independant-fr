// e2e-web/support/police.ts
// Police large dans les tests de la démo web. L'application ne fixe pas de police : chaque système prend la sienne,
// et celle de Linux (DejaVu Sans) est bien plus large que celle de Windows (Segoe UI). Les tests de largeur sur
// téléphone passent aussi avec une police large imposée, pour qu'un débordement se voie sur tous les systèmes.

import type { BrowserContext } from "@playwright/test"

/** Polices essayées par les tests de largeur sur téléphone : celle du système, puis une police large. */
export const POLICES = ["police du système", "police large"] as const
export type Police = (typeof POLICES)[number]

/** Impose une police large (Verdana sous Windows, DejaVu Sans sous Linux) à toutes les pages du contexte. */
export async function imposerUnePoliceLarge(contexte: BrowserContext) {
  await contexte.addInitScript(() => {
    const style = document.createElement("style")
    style.textContent = `html, body, button, input, select, textarea { font-family: Verdana, "DejaVu Sans", sans-serif !important; }`
    document.addEventListener("DOMContentLoaded", () => document.head.append(style))
  })
}

/** Impose la police voulue aux pages du contexte, avant leur chargement : rien à faire pour celle du système. */
export async function choisirLaPolice(contexte: BrowserContext, police: Police) {
  if (police === "police large") await imposerUnePoliceLarge(contexte)
}
