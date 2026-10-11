// src/ui/components/Depliable.tsx

import { useState, type ReactNode, type SyntheticEvent } from "react"
import { ChevronRight } from "lucide-react"
import { cn } from "@/lib/utils"
import { proprietesDeDetails, useSectionOuverte } from "../hooks/useSectionOuverte"

interface DepliableProps {
  titre: ReactNode
  /**
   * Identifiant stable de la section : son état ouvert ou fermé est alors retenu d'une ouverture à l'autre (voir
   * useSectionOuverte). Sans lui, la section s'ouvre fermée à chaque fois, sauf `ouverteParDefaut`.
   */
  id?: string
  /**
   * Avec `id` : état de la section tant que l'utilisateur ne l'a ni ouverte ni fermée. Sans `id` : état à chaque
   * affichage.
   */
  ouverteParDefaut?: boolean
  className?: string
  children: ReactNode
}

/** Section repliable : un chevron et une indication « afficher / masquer » montrent qu'on peut cliquer. */
export function Depliable({ id, ouverteParDefaut, ...props }: DepliableProps) {
  if (id) return <DepliableRetenu id={id} ouverteParDefaut={ouverteParDefaut} {...props} />
  return ouverteParDefaut ? <DepliableOuverteAuDepart {...props} /> : <Section {...props} />
}

/** Section ouverte à son affichage (une aide utile tant qu'une valeur manque), sans mémoire d'une fois à l'autre. */
function DepliableOuverteAuDepart(props: Omit<DepliableProps, "id" | "ouverteParDefaut">) {
  const [ouverte, setOuverte] = useState(true)
  return <Section {...props} {...proprietesDeDetails(ouverte, setOuverte)} />
}

function DepliableRetenu({ id, ouverteParDefaut, ...props }: DepliableProps & { id: string }) {
  const [ouverte, definir] = useSectionOuverte(id, ouverteParDefaut)
  return <Section {...props} {...proprietesDeDetails(ouverte, definir)} />
}

interface SectionProps extends Omit<DepliableProps, "id" | "ouverteParDefaut"> {
  open?: boolean
  onToggle?: (evenement: SyntheticEvent<HTMLDetailsElement>) => void
}

function Section({ titre, className, children, open, onToggle }: SectionProps) {
  return (
    <details className={cn("group", className)} open={open} onToggle={onToggle}>
      <summary className="flex min-h-6 w-fit cursor-pointer list-none items-center gap-1.5 rounded-md pointer-coarse:min-h-11 font-medium hover:text-slate-950 dark:hover:text-white [&::-webkit-details-marker]:hidden">
        <ChevronRight aria-hidden className="h-4 w-4 shrink-0 transition-transform group-open:rotate-90 print:hidden" />
        {titre}
        {/* Sur papier, la section est toujours dépliée (voir impression.css) : l'invitation à cliquer n'a plus lieu d'être. */}
        <span className="font-normal text-blue-600 underline-offset-2 group-hover:underline dark:text-blue-400 print:hidden">
          <span className="group-open:hidden">(afficher)</span>
          <span className="hidden group-open:inline">(masquer)</span>
        </span>
      </summary>
      {children}
    </details>
  )
}
