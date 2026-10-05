// src/ui/hooks/useSectionOuverte.ts
// Mémoire des sections repliables : une section ouverte ou fermée par l'utilisateur le reste d'une ouverture à
// l'autre. L'état est rangé dans ses préférences (voir src/lib/preferences.ts), par identifiant stable de section.
//
// L'impression déplie toutes les sections sans toucher à cette mémoire : src/ui/impression.ts ouvre les sections
// fermées puis les referme après l'impression, et la feuille d'impression les déplie déjà dans Chromium. Une section
// pilotée par ce hook voit passer ces deux bascules ; elle revient à son état, qui reste celui retenu.

import { createContext, useCallback, useContext, useMemo, useState, type Dispatch, type SetStateAction, type SyntheticEvent } from "react"
import { avecSectionOuverte } from "@/lib/preferences"
import type { UserPreferences } from "@/types"

export interface MemoireDesSections {
  /** État retenu de chaque section, par identifiant ; une section absente garde son état par défaut. */
  sectionsOuvertes: Record<string, boolean> | undefined
  retenir: (id: string, ouverte: boolean) => void
}

/** Hors de tout fournisseur (tests de composants isolés), chaque section garde son état pour elle seule, sans le retenir. */
export const MemoireDesSectionsContext = createContext<MemoireDesSections | null>(null)

/** Mémoire des sections rangée dans les préférences de l'utilisateur, à fournir par MemoireDesSectionsContext. */
export function useMemoireDesSections(sectionsOuvertes: Record<string, boolean> | undefined, setPreferences: Dispatch<SetStateAction<UserPreferences>>): MemoireDesSections {
  const retenir = useCallback((id: string, ouverte: boolean) => setPreferences(prefs => avecSectionOuverte(prefs, id, ouverte)), [setPreferences])
  return useMemo(() => ({ sectionsOuvertes, retenir }), [sectionsOuvertes, retenir])
}

/**
 * État ouvert ou fermé d'une section repliable, retenu sous l'identifiant `id` : un nom stable, propre à la section
 * (« legende-des-flux »), suivi au besoin de l'acteur ou de l'affichage concerné (« detail-calcul:p-alice »).
 * @returns L'état de la section, et la fonction qui le change et le retient.
 */
export function useSectionOuverte(id: string, ouverteParDefaut = false): [boolean, (ouverte: boolean) => void] {
  const memoire = useContext(MemoireDesSectionsContext)
  const [locale, setLocale] = useState<boolean | undefined>(undefined)
  const retenue = memoire ? memoire.sectionsOuvertes?.[id] : locale
  const definir = useCallback((ouverte: boolean) => (memoire ? memoire.retenir(id, ouverte) : setLocale(ouverte)), [memoire, id])
  return [retenue ?? ouverteParDefaut, definir]
}

/**
 * Propriétés d'un élément `<details>` piloté par useSectionOuverte : `<details {...proprietesDeDetails(ouverte, definir)}>`.
 * La bascule faite par le navigateur (clic sur le résumé, impression) est retenue si elle change l'état.
 */
export function proprietesDeDetails(ouverte: boolean, definir: (ouverte: boolean) => void) {
  return {
    open: ouverte,
    onToggle: (evenement: SyntheticEvent<HTMLDetailsElement>) => {
      if (evenement.currentTarget.open !== ouverte) definir(evenement.currentTarget.open)
    }
  }
}
