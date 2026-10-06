// src/web/pwa/strategie.ts
// Les choix du service worker (service-worker.ts), en fonctions pures : le nom de son cache, les anciens caches à
// effacer, et la réponse à donner à chaque requête.

export const PREFIXE_DU_CACHE = "simulateur-demo-"

/** Le cache d'une version publiée de la démo : une nouvelle publication remplit un nouveau cache. */
export const nomDuCache = (version: string) => `${PREFIXE_DU_CACHE}${version}`

/** Les caches des versions précédentes de la démo, à effacer quand la nouvelle version prend la main. */
export function cachesPerimes(noms: readonly string[], actuel: string): string[] {
  return noms.filter(nom => nom.startsWith(PREFIXE_DU_CACHE) && nom !== actuel)
}

/** Ce que le service worker sait d'une requête. */
export interface RequeteInterceptee {
  url: string
  method: string
  /** `navigate` pour l'ouverture d'une page. */
  mode: string
}

/**
 * - `cache` : un fichier de la démo, servi depuis le cache (son nom change à chaque modification, sauf index.html,
 *   renouvelé avec le cache à chaque publication).
 * - `page` : l'ouverture d'une adresse de la démo, à laquelle répond la page de l'application gardée en cache.
 * - `reseau` : tout le reste (autre site, autre méthode que GET, fichier hors du cache), laissé au navigateur.
 */
export type Strategie = { type: "cache"; chemin: string } | { type: "page"; chemin: string } | { type: "reseau" }

/**
 * La réponse à une requête, d'après la portée du service worker (`https://…/simulateur-independant-fr/`) et les
 * chemins mis en cache, relatifs à cette portée.
 */
export function strategiePour(requete: RequeteInterceptee, portee: string, enCache: ReadonlySet<string>): Strategie {
  if (requete.method !== "GET" || !requete.url.startsWith(portee)) return { type: "reseau" }
  // Le paramètre de recherche et l'ancre ne changent pas le fichier servi.
  const chemin = new URL(requete.url).pathname.slice(new URL(portee).pathname.length)
  if (enCache.has(chemin)) return { type: "cache", chemin }
  if (requete.mode === "navigate" && enCache.has("index.html")) return { type: "page", chemin: "index.html" }
  return { type: "reseau" }
}
