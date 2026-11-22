// src/ui/allerALaReponse.ts
// Après le chargement d'une situation type depuis une question, mener à la zone de la page qui y répond : attendre
// qu'elle soit affichée (les résultats et le comparateur arrivent après leur calcul), ouvrir les sections repliées qui
// la contiennent, s'y rendre, puis la signaler un instant (`data-reperee`, voir App.css).
//
// Dans l'affichage « Trois vues », le passage par l'adresse (#comparateur-titre) ouvre la vue qui la contient, comme les
// liens de la barre de résumé ; ailleurs, la page défile jusqu'à elle. Les barres collées en haut réservent leur
// hauteur (scroll-padding-top), le défilement s'arrête dessous.

import { lienVers, type Ancre } from "@/lib/ancres"

/** Délai au-delà duquel la zone n'arrivera plus : la situation ne l'affiche pas (pas de société, pas de couple). */
const ATTENTE_MAXIMALE = 5000
const INTERVALLE = 100
/** Passages sans mouvement de la zone avant de s'y rendre (trois fois 100 ms). */
const PASSAGES_IMMOBILES = 3
/** Durée du signalement de la zone, celle de son animation. */
const DUREE_DU_REPERAGE = 2400

/** Ouvre chaque section repliable (`<details>`) qui contient l'élément : il devient visible. */
function ouvrirCeQuiLeContient(element: HTMLElement) {
  for (let parent = element.parentElement; parent; parent = parent.parentElement) {
    if (parent instanceof HTMLDetailsElement && !parent.open) parent.open = true
  }
}

/** Ce qui est signalé : la section qui porte la zone (un titre seul serait un trait), sinon la zone elle-même. */
function cadreDe(element: HTMLElement): HTMLElement {
  return element.closest<HTMLElement>("section, [role=region]") ?? element
}

function seRendreA(ancre: Ancre, element: HTMLElement) {
  ouvrirCeQuiLeContient(element)
  const cadre = cadreDe(element)
  if (element.closest("[data-vue]")) {
    // « Trois vues » : l'adresse ouvre la vue de la zone et y défile (useVues) ; la même adresse ne serait pas suivie.
    if (window.location.hash === lienVers(ancre)) window.history.replaceState(window.history.state, "", window.location.pathname + window.location.search)
    window.location.hash = lienVers(ancre)
  } else {
    // Le cadre entier, signalé, sous les barres collées en haut ; pas seulement son titre.
    cadre.scrollIntoView({ block: "start" })
  }
  // Le focus suit, pour les lecteurs d'écran et le clavier : un titre ne le prend que par programme.
  if (element.tabIndex < 0 && !element.hasAttribute("tabindex")) element.setAttribute("tabindex", "-1")
  element.focus({ preventScroll: true })
  cadre.setAttribute("data-reperee", "")
  window.setTimeout(() => cadre.removeAttribute("data-reperee"), DUREE_DU_REPERAGE)
}

/**
 * Mène à la zone de la page qui répond à une question, dès qu'elle est affichée. Rien ne se passe si elle ne l'est pas
 * dans les cinq secondes ; un nouvel appel annule le précédent.
 * @returns Une fonction qui arrête l'attente.
 */
export function allerALaReponse(ancre: Ancre): () => void {
  annulerLAttente?.()
  const debut = Date.now()
  let minuterie = 0
  // Position de la zone dans la page aux derniers passages : les résultats calculés au-dessus la repoussent encore un
  // moment ; on s'y rend quand elle ne bouge plus.
  let position: number | null = null
  let immobile = 0
  const chercher = () => {
    const element = document.getElementById(ancre)
    const ici = element ? element.getBoundingClientRect().top + window.scrollY : null
    immobile = ici !== null && position !== null && Math.abs(ici - position) < 1 ? immobile + 1 : 0
    position = ici
    const tempsEcoule = Date.now() - debut >= ATTENTE_MAXIMALE
    if (element && (immobile >= PASSAGES_IMMOBILES || tempsEcoule)) {
      annulerLAttente = null
      seRendreA(ancre, element)
      return
    }
    if (!tempsEcoule) minuterie = window.setTimeout(chercher, INTERVALLE)
    else annulerLAttente = null
  }
  const annuler = () => window.clearTimeout(minuterie)
  annulerLAttente = annuler
  // Après le rendu de la situation chargée.
  minuterie = window.setTimeout(chercher, INTERVALLE)
  return annuler
}

let annulerLAttente: (() => void) | null = null
