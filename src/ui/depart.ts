// src/ui/depart.ts
// « Par où commencer ? » (BibliothequeDuDepart.tsx, la fenêtre de MontagesTypes.tsx, le bloc de ParOuCommencer.tsx) :
// ce que la bibliothèque retient tant qu'elle est affichée, et l'action « Partir de zéro » fournie par l'application.

import { createContext } from "react"
import { toast } from "sonner"
import { AUCUN_CRITERE, type CriteresDesMontages, type QuestionTrouvee } from "@/lib/montages/filtres"
import { ID_DE_L_AJOUT_D_UNE_PERSONNE, ID_DU_BOUTON_DES_SITUATIONS, ID_DU_MENU_PLUS_D_ACTIONS } from "@/lib/questions-de-depart"
import { signalerUnInstant } from "./allerALaReponse"

export type OngletDuDepart = "questions" | "situations"

/** Ce que la bibliothèque retient tant qu'elle est affichée : l'onglet, les critères, la question suivie, la dernière carte vue. */
export interface EtatDeLaBibliotheque {
  onglet: OngletDuDepart
  criteres: CriteresDesMontages
  /** La question dont on a ouvert la situation : sa carte est mise en avant (son « Charger » mène en haut de la page, comme les autres). */
  questionSuivie: QuestionTrouvee | null
  /** Dernière situation dont on a vu le détail : de retour à la liste, le focus revient sur sa carte. */
  montageVu: string | null
}

/**
 * À l'ouverture : la fenêtre, ouverte par « Situations types » ou « Partir d'une situation type… », montre les
 * situations ; le bloc de la page, au premier lancement, les questions.
 */
export const etatInitialDeLaBibliotheque = (onglet: OngletDuDepart): EtatDeLaBibliotheque => ({ onglet, criteres: AUCUN_CRITERE, questionSuivie: null, montageVu: null })

/** Remplace la simulation par une simulation vierge et affiche la saisie ; hors de l'application, `null`. */
export const PartirDeZeroContext = createContext<(() => void) | null>(null)

/**
 * Une fois la saisie affichée : la page remonte tout en haut (la simulation vierge se lit depuis son début) et le focus
 * passe sur l'ajout d'une personne, sans faire défiler la page jusqu'à lui.
 */
export function allerALaSaisie() {
  requestAnimationFrame(() => {
    window.scrollTo(0, 0)
    document.getElementById(ID_DE_L_AJOUT_D_UNE_PERSONNE)?.focus({ preventScroll: true })
  })
}

/** L'élément est affiché (une classe `hidden` ou un ancêtre masqué ne lui laissent aucune boîte). */
const estAffiche = (element: HTMLElement | null): element is HTMLElement => Boolean(element && element.getClientRects().length > 0)

/**
 * Le bloc « Par où commencer ? » vient de s'effacer de la page (« Partir de zéro ») : montrer où le retrouver. L'entrée
 * de la barre d'outils affichée est signalée un instant (« Situations types », ou « Plus d'actions » sur un téléphone),
 * et une notification, lue par les lecteurs d'écran, la nomme.
 */
export function montrerOuRetrouverLeDepart() {
  const bouton = document.getElementById(ID_DU_BOUTON_DES_SITUATIONS)
  const menu = document.getElementById(ID_DU_MENU_PLUS_D_ACTIONS)
  if (estAffiche(bouton)) {
    signalerUnInstant(bouton)
    toast.info("Questions et situations types : bouton « Situations types » de la barre d'outils.")
  } else if (estAffiche(menu)) {
    signalerUnInstant(menu)
    // En bas : en haut, sur un téléphone, la notification couvrirait la barre d'outils et le bouton signalé.
    toast.info("Questions et situations types : menu « Plus d'actions », puis « Partir d'une situation type ».", { position: "bottom-center" })
  }
}
