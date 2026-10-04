// src/ui/impression.ts
// Préparation de la page à l'impression et à l'export PDF. La mise en page elle-même est dans impression.css.

/** Date du document imprimé, en toutes lettres (« 4 octobre 2026 »). */
export function dateDuDocument(date = new Date()): string {
  return date.toLocaleDateString("fr-FR", { dateStyle: "long" })
}

/**
 * Règles @page propres à la simulation : son nom et la date en tête de chaque page, sauf la première, qui les
 * affiche déjà sous le titre. Les textes sont des chaînes CSS échappées (JSON.stringify), sans risque d'injection.
 */
export function styleDesPages(nomDeLaSimulation: string, date: string): string {
  const nom = JSON.stringify(nomDeLaSimulation)
  const jour = JSON.stringify(`Document du ${date}`)
  return `@page { @top-left { content: ${nom}; } @top-right { content: ${jour}; } } @page :first { @top-left { content: none; } @top-right { content: none; } }`
}

/** Déplie les sections repliables fermées ; renvoie la fonction qui replie celles-là, et elles seules. */
export function deplierPourImpression(racine: ParentNode = document): () => void {
  const fermees = Array.from(racine.querySelectorAll<HTMLDetailsElement>("details:not([open])"))
  fermees.forEach(section => (section.open = true))
  return () => fermees.forEach(section => (section.open = false))
}

/**
 * Déplie les sections repliables le temps d'une impression : celle du navigateur (Ctrl+P, export PDF de la démo web)
 * comme l'export PDF d'Electron, qui émet les mêmes événements. Chromium les déplie déjà
 * par la feuille de style (::details-content) ; les autres navigateurs ont besoin de ce relais.
 * Renvoie la fonction qui retire les écouteurs.
 */
export function suivreImpression(): () => void {
  let replier: (() => void) | null = null
  const avant = () => {
    replier?.()
    replier = deplierPourImpression()
  }
  const apres = () => {
    replier?.()
    replier = null
  }
  window.addEventListener("beforeprint", avant)
  window.addEventListener("afterprint", apres)
  return () => {
    window.removeEventListener("beforeprint", avant)
    window.removeEventListener("afterprint", apres)
  }
}
