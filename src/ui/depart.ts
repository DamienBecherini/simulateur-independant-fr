// src/ui/depart.ts
// « Par où commencer ? » (BibliothequeDuDepart.tsx, la fenêtre de MontagesTypes.tsx, le bloc de ParOuCommencer.tsx) :
// ce que la bibliothèque retient tant qu'elle est affichée, et l'action « Partir de zéro » fournie par l'application.

import { createContext } from "react"
import { AUCUN_CRITERE, type CriteresDesMontages, type QuestionTrouvee } from "@/lib/montages/filtres"
import { ID_DE_L_AJOUT_D_UNE_PERSONNE } from "@/lib/questions-de-depart"

export type OngletDuDepart = "questions" | "situations"

/** Ce que la bibliothèque retient tant qu'elle est affichée : l'onglet, les critères, la question suivie, la dernière carte vue. */
export interface EtatDeLaBibliotheque {
  onglet: OngletDuDepart
  criteres: CriteresDesMontages
  /** La question dont on a ouvert la situation : sa carte est mise en avant, et « Charger » mène à sa réponse. */
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

/** Porte le focus sur l'ajout d'une personne, une fois la saisie affichée. */
export function allerALaSaisie() {
  requestAnimationFrame(() => document.getElementById(ID_DE_L_AJOUT_D_UNE_PERSONNE)?.focus())
}
