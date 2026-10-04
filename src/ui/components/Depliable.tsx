// src/ui/components/Depliable.tsx

import type { ReactNode } from "react"
import { ChevronRight } from "lucide-react"
import { cn } from "@/lib/utils"

/** Section repliable : un chevron et une indication « afficher / masquer » montrent qu'on peut cliquer. */
export function Depliable({ titre, className, children }: { titre: string; className?: string; children: ReactNode }) {
  return (
    <details className={cn("group", className)}>
      <summary className="flex w-fit cursor-pointer list-none items-center gap-1.5 rounded-md font-medium hover:text-slate-950 dark:hover:text-white [&::-webkit-details-marker]:hidden">
        <ChevronRight aria-hidden className="h-4 w-4 shrink-0 transition-transform group-open:rotate-90" />
        {titre}
        <span className="font-normal text-blue-600 underline-offset-2 group-hover:underline dark:text-blue-400">
          <span className="group-open:hidden">(afficher)</span>
          <span className="hidden group-open:inline">(masquer)</span>
        </span>
      </summary>
      {children}
    </details>
  )
}
