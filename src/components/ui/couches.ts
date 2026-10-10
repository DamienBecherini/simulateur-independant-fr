// src/components/ui/couches.ts
// Échap ne ferme que la couche du dessus (fenêtre, panneau), même juste après l'ouverture d'une couche par-dessus.
//
// Depuis @radix-ui/react-dismissable-layer 1.1.14 (react-dialog 1.1.18), une couche n'écoute Échap que si elle se
// savait la plus haute à son dernier rendu. Quand une fenêtre s'ouvre par-dessus une autre, celle du dessous ne
// l'apprend qu'à un rendu suivant, que Radix déclenche par un événement interne, une tâche plus tard. Entre-temps,
// c'est elle qui reçoit Échap : elle se ferme, et avec elle la fenêtre ouverte depuis son contenu (« Mentions
// légales » ouvertes depuis « Configuration »), tandis que la nouvelle fenêtre n'écoute pas encore la touche.
// Signalé à Radix : https://github.com/radix-ui/primitives/issues/4143 (correctifs proposés, pas encore publiés).
//
// Ici, la couche visée par Échap est celle qui contient l'élément qui a le focus, à l'instant de la touche. Une
// couche qui reçoit de Radix une touche qui en vise une autre reste ouverte, et transmet la touche à la couche visée,
// qui la traite comme Radix le ferait : son gestionnaire onEscapeKeyDown, puis la fermeture.

import { createContext, useCallback, useContext, useLayoutEffect, useMemo, useRef, useState, type Ref, type RefCallback } from "react"

/** Contenus des couches de Radix, repérés par l'attribut data-slot de nos composants. */
const COUCHES = ["dialog-content", "alert-dialog-content", "sheet-content", "select-content"].map(nom => `[data-slot="${nom}"]`).join(",")

/** La couche qui contient la cible de l'événement (le focus, pour une touche), ou null. */
const coucheVisee = (cible: EventTarget | null): Element | null => (cible instanceof Element ? cible.closest(COUCHES) : null)

/** Ce que fait chaque fenêtre ouverte d'une touche Échap qui la vise. */
const gestionnaires = new Map<Element, (evenement: KeyboardEvent) => void>()

/** Ferme la couche, par le onOpenChange de sa racine (Dialog, AlertDialog, Sheet). */
export const FermetureDeLaCouche = createContext<() => void>(() => {})

/**
 * L'état d'ouverture d'une racine, contrôlé (open) ou non (defaultOpen), et de quoi la fermer, que la racine fournit
 * à son contenu par FermetureDeLaCouche.
 */
export function useOuverture(open: boolean | undefined, defaultOpen: boolean | undefined, onOpenChange: ((ouvert: boolean) => void) | undefined) {
  const [interne, setInterne] = useState(defaultOpen ?? false)
  const controle = open !== undefined
  const changer = useCallback(
    (ouvert: boolean) => {
      if (!controle) setInterne(ouvert)
      onOpenChange?.(ouvert)
    },
    [controle, onOpenChange]
  )
  const fermer = useCallback(() => changer(false), [changer])
  return { ouvert: controle ? open : interne, changer, fermer }
}

/** Assemble deux refs en une, avec le nettoyage des refs de React 19. */
function assembler<T>(ref: Ref<T> | undefined, rappel: RefCallback<T>): RefCallback<T> {
  return noeud => {
    const nettoyerLeRappel = rappel(noeud)
    let nettoyerLaRef = () => {}
    if (typeof ref === "function") {
      const nettoyage = ref(noeud)
      nettoyerLaRef = typeof nettoyage === "function" ? nettoyage : () => ref(null)
    } else if (ref) {
      ref.current = noeud
      nettoyerLaRef = () => (ref.current = null)
    }
    return () => {
      nettoyerLaRef()
      nettoyerLeRappel?.()
    }
  }
}

interface ProprietesDEchap<T> {
  ref?: Ref<T>
  onEscapeKeyDown?: (evenement: KeyboardEvent) => void
}

/**
 * Les propriétés ref et onEscapeKeyDown à donner au contenu d'une couche (DialogPrimitive.Content…) pour qu'Échap
 * ne ferme que la couche visée. Elles reprennent celles du composant.
 */
export function useEchapDeLaCouche<T extends HTMLElement>({ ref, onEscapeKeyDown }: ProprietesDEchap<T>) {
  const fermer = useContext(FermetureDeLaCouche)
  const noeud = useRef<T | null>(null)

  // Échap reçu par une autre couche, qui visait celle-ci : la décision de Radix, prise à sa place.
  const traiter = useRef<(evenement: KeyboardEvent) => void>(() => {})
  useLayoutEffect(() => {
    traiter.current = evenement => {
      onEscapeKeyDown?.(evenement)
      if (!evenement.defaultPrevented) fermer()
    }
  })

  const enregistrer = useCallback((element: T | null) => {
    noeud.current = element
    if (!element) return
    gestionnaires.set(element, evenement => traiter.current(evenement))
    return () => {
      gestionnaires.delete(element)
      noeud.current = null
    }
  }, [])

  return {
    ref: useMemo(() => assembler(ref, enregistrer), [ref, enregistrer]),
    // Appelé par Radix sur la couche qu'il croit la plus haute, avant de la fermer si l'événement n'est pas annulé.
    onEscapeKeyDown(evenement: KeyboardEvent) {
      const visee = coucheVisee(evenement.target)
      if (visee && visee !== noeud.current) {
        gestionnaires.get(visee)?.(evenement)
        evenement.preventDefault()
        return
      }
      onEscapeKeyDown?.(evenement)
    }
  }
}
