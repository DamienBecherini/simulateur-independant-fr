// src/ui/hooks/useVues.ts
// Affichage « Trois vues » (proposition B de l'étude d'allègement de l'écran) : la vue affichée, tenue à jour avec
// l'adresse de la page. Choisir une vue ajoute une entrée à l'historique (#situation, #resultats, #comparer) ; un lien
// vers un détail d'une autre vue (#bilan) ouvre cette vue ; le retour arrière et le rechargement retrouvent la vue.
// L'adresse ne change que par son fragment : cela vaut pour la démo web comme pour Electron (fichier local).

import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useRef, useState } from "react"
import { VUE_PAR_DEFAUT, destinationDeLAdresse, titreDeLaFenetre, type Vue } from "@/lib/vues"

export interface Vues {
  vue: Vue
  /**
   * Ouvre une vue depuis les onglets, en haut de la page. Le focus va au titre de la vue, sauf avec `garderLeFocus`
   * (flèches du clavier dans les onglets : le focus suit l'onglet).
   */
  choisir: (vue: Vue, garderLeFocus?: boolean) => void
}

/** Les vues de la page ; `null` hors de l'affichage « Trois vues » : la page est alors d'un seul tenant. */
export const VuesContext = createContext<Vues | null>(null)

export function useVuesDeLaPage(): Vues | null {
  return useContext(VuesContext)
}

export const idDeLaVue = (vue: Vue) => `vue-${vue}`
export const idDeLOnglet = (vue: Vue) => `onglet-${vue}`
export const idDuTitreDeLaVue = (vue: Vue) => `vue-${vue}-titre`

/** Ce qu'il reste à faire une fois la vue affichée. */
interface Arrivee {
  /** Élément à montrer ; sinon, le haut de la page. */
  detail?: string
  /** Remonter en haut de la page quand il n'y a pas de détail à montrer. */
  enHaut: boolean
  /** Déplacer le focus : sur le détail, ou sur le titre de la vue. */
  focus: boolean
}

/** Vue qui contient un élément de la page, d'après l'attribut `data-vue` de son conteneur. */
function vueDeLElement(id: string): Vue | null {
  const conteneur = document.getElementById(id)?.closest<HTMLElement>("[data-vue]")
  return (conteneur?.dataset.vue as Vue | undefined) ?? null
}

/** Destination de l'adresse actuelle ; une adresse vide mène à la première vue (retour à l'entrée d'origine). */
function destinationActuelle() {
  return window.location.hash ? destinationDeLAdresse(window.location.hash, vueDeLElement) : { vue: VUE_PAR_DEFAUT }
}

/** Montre la vue ou son détail, et y porte le focus si demandé. */
function arriver(vue: Vue, arrivee: Arrivee) {
  const detail = arrivee.detail ? document.getElementById(arrivee.detail) : null
  if (detail) {
    detail.scrollIntoView({ block: "start" })
    // Un détail qui ne prend pas le focus de lui-même (un bloc de texte) le reçoit par programme seulement.
    if (arrivee.focus && detail.tabIndex < 0 && !detail.hasAttribute("tabindex")) detail.setAttribute("tabindex", "-1")
    if (arrivee.focus) detail.focus({ preventScroll: true })
    return
  }
  if (arrivee.enHaut) window.scrollTo(0, 0)
  if (arrivee.focus) document.getElementById(idDuTitreDeLaVue(vue))?.focus({ preventScroll: true })
}

/** Le titre de la fenêtre nomme la vue, le temps de l'affichage « Trois vues ». */
function useTitreDeLaFenetre(actif: boolean, vue: Vue, nomDeLaSimulation: string) {
  useEffect(() => {
    if (!actif) return
    const titre = document.title
    document.title = titreDeLaFenetre(vue, nomDeLaSimulation)
    return () => {
      document.title = titre
    }
  }, [actif, vue, nomDeLaSimulation])
}

/** Les vues de la page ; `null` hors de l'affichage « Trois vues ». */
export function useVues(actif: boolean, nomDeLaSimulation: string): Vues | null {
  const [etat, setEtat] = useState<{ vue: Vue; arrivee: Arrivee | null }>(() => ({ vue: destinationDeLAdresse(window.location.hash, () => null)?.vue ?? VUE_PAR_DEFAUT, arrivee: null }))
  // Vue affichée, connue sans attendre le rendu : l'historique peut signaler deux fois le même changement (popstate, hashchange).
  const vueAffichee = useRef(etat.vue)
  const arriveeTraitee = useRef<Arrivee | null>(null)

  const afficher = useCallback((vue: Vue, arrivee: Arrivee) => {
    vueAffichee.current = vue
    setEtat({ vue, arrivee })
  }, [])

  useEffect(() => {
    if (!actif) return
    // À l'arrivée dans l'affichage (chargement de la page, rechargement, choix de l'affichage) : la vue de l'adresse,
    // sans prendre le focus. La position dans la page est gérée ici, et non par le navigateur, qui la rétablirait
    // dans une autre vue que celle où elle avait été retenue.
    const restauration = window.history.scrollRestoration
    window.history.scrollRestoration = "manual"
    const initiale = destinationActuelle()
    // L'adresse est un système extérieur, lu à l'arrivée dans l'affichage (actif) en même temps que l'abonnement à ses
    // changements ; l'arrivée retenue déclenche ensuite, avant l'affichage, le placement dans la page (useLayoutEffect).
    // eslint-disable-next-line react-hooks/set-state-in-effect -- synchronisation voulue avec l'adresse, voir ci-dessus
    if (initiale) afficher(initiale.vue, { detail: initiale.detail, enHaut: false, focus: false })

    const suivre = () => {
      const destination = destinationActuelle()
      // Même vue : le navigateur montre lui-même le détail, déjà affiché.
      if (!destination || destination.vue === vueAffichee.current) return
      afficher(destination.vue, { detail: destination.detail, enHaut: true, focus: true })
    }
    window.addEventListener("hashchange", suivre)
    window.addEventListener("popstate", suivre)
    return () => {
      window.history.scrollRestoration = restauration
      window.removeEventListener("hashchange", suivre)
      window.removeEventListener("popstate", suivre)
    }
  }, [actif, afficher])

  useLayoutEffect(() => {
    if (!actif || !etat.arrivee || arriveeTraitee.current === etat.arrivee) return
    arriveeTraitee.current = etat.arrivee
    arriver(etat.vue, etat.arrivee)
  }, [actif, etat])

  useTitreDeLaFenetre(actif, etat.vue, nomDeLaSimulation)

  const choisir = useCallback(
    (vue: Vue, garderLeFocus = false) => {
      if (vue === vueAffichee.current) return
      window.history.pushState(window.history.state, "", `#${vue}`)
      afficher(vue, { enHaut: true, focus: !garderLeFocus })
    },
    [afficher]
  )

  return actif ? { vue: etat.vue, choisir } : null
}
