import { useEffect, useRef } from "react"

/**
 * Enregistre des données après un délai d'inactivité (sauvegarde automatique).
 *
 * Rien n'est enregistré tant que `actif` est faux : la session affichée avant la fin du chargement est une session
 * vierge provisoire, qui ne doit jamais remplacer celle du disque (même si le chargement échoue, ou sous `StrictMode`,
 * qui exécute les effets deux fois). Les données présentes quand `actif` devient vrai, celles qu'on vient de charger,
 * ne sont pas réenregistrées : seule une modification ultérieure déclenche une sauvegarde.
 * @param data Les données à enregistrer.
 * @param delay Le délai d'inactivité, en millisecondes.
 * @param saveCallback La fonction d'enregistrement.
 * @param actif Faux tant que les données enregistrées ne sont pas chargées.
 */
export function useDebouncedSave<T>(data: T, delay: number, saveCallback: (data: T) => void, actif: boolean) {
  // Les données chargées, retenues quand `actif` devient vrai.
  const chargees = useRef<{ donnees: T } | null>(null)

  useEffect(() => {
    if (!actif) return
    chargees.current ??= { donnees: data }
    if (Object.is(data, chargees.current.donnees)) return

    const minuterie = setTimeout(() => saveCallback(data), delay)
    return () => clearTimeout(minuterie)
  }, [data, delay, saveCallback, actif])
}
