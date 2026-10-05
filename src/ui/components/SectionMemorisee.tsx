// src/ui/components/SectionMemorisee.tsx

import { useEffect, useLayoutEffect, useRef, type ReactNode } from "react"
import { useSectionOuverte } from "../hooks/useSectionOuverte"

interface SectionMemoriseeProps {
  /** Identifiant stable de la section, sous lequel son état est retenu (voir useSectionOuverte). */
  id: string
  ouverteParDefaut?: boolean
  children: ReactNode
}

/**
 * Retient l'état de la première section repliable (`<details>`) qu'elle contient, sans changer le composant qui
 * l'affiche (Depliable, ReplieEnResume) : l'état retenu lui est appliqué à chaque affichage, et chaque bascule est
 * retenue. Sans section repliable (affichage classique, où le détail est affiché tel quel), elle ne fait rien.
 * L'enveloppe est en `display: contents` : elle ne change pas la mise en page.
 */
export function SectionMemorisee({ id, ouverteParDefaut = false, children }: SectionMemoriseeProps) {
  const [ouverte, definir] = useSectionOuverte(id, ouverteParDefaut)
  const enveloppe = useRef<HTMLDivElement>(null)
  const section = () => enveloppe.current?.querySelector("details") ?? null

  // L'état retenu est appliqué à une section qui apparaît (changement d'affichage) et quand il change, pas à chaque
  // affichage : une bascule pas encore signalée par l'événement `toggle` ne doit pas être défaite.
  const etat = useRef({ ouverte, definir })
  const applique = useRef<{ details: HTMLDetailsElement | null; ouverte: boolean }>({ details: null, ouverte })
  useLayoutEffect(() => {
    etat.current = { ouverte, definir }
    const details = section()
    if (!details || (details === applique.current.details && ouverte === applique.current.ouverte)) return
    applique.current = { details, ouverte }
    if (details.open !== ouverte) details.open = ouverte
  })

  // L'événement `toggle` ne remonte pas : on l'écoute pendant sa descente (capture), sur l'enveloppe.
  useEffect(() => {
    const racine = enveloppe.current
    if (!racine) return
    const surBascule = (evenement: Event) => {
      if (evenement.target !== section() || !(evenement.target instanceof HTMLDetailsElement)) return
      if (evenement.target.open !== etat.current.ouverte) etat.current.definir(evenement.target.open)
    }
    racine.addEventListener("toggle", surBascule, true)
    return () => racine.removeEventListener("toggle", surBascule, true)
  }, [])

  return (
    <div ref={enveloppe} className="contents">
      {children}
    </div>
  )
}
