// src/web/ApplicationDeBureau.tsx
// Les liens de la démo web vers l'application de bureau : la dernière version publiée et le guide d'installation.
// L'aide à l'installation (navigateurs qui n'installent pas la démo) et la fenêtre « Utiliser avec une IA (MCP) »
// de la démo s'en servent.

import { BookOpen, Download } from "lucide-react"
import { Button } from "@/components/ui/button"
import { DEPOT_GITHUB } from "@/lib/adresses-des-retours"

export const ADRESSE_DU_TELECHARGEMENT = `${DEPOT_GITHUB}/releases/latest`
export const ADRESSE_DU_GUIDE_D_INSTALLATION = `${DEPOT_GITHUB}/blob/main/documentation/installation.md`

const NOUVEL_ONGLET = <span className="sr-only"> (nouvel onglet)</span>

export function LiensVersLApplicationDeBureau() {
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        <Button asChild className="h-auto min-h-11 whitespace-normal max-sm:w-full">
          <a href={ADRESSE_DU_TELECHARGEMENT} target="_blank" rel="noreferrer">
            <Download className="mr-2 size-4" aria-hidden="true" /> Télécharger l'application{NOUVEL_ONGLET}
          </a>
        </Button>
        <Button asChild variant="outline" className="h-auto min-h-11 whitespace-normal max-sm:w-full">
          <a href={ADRESSE_DU_GUIDE_D_INSTALLATION} target="_blank" rel="noreferrer">
            <BookOpen className="mr-2 size-4" aria-hidden="true" /> Guide d'installation{NOUVEL_ONGLET}
          </a>
        </Button>
      </div>
      <p className="text-sm text-slate-600 dark:text-slate-400">Pour Windows, macOS et Linux, gratuite et open source. Bientôt sur le Microsoft Store.</p>
    </div>
  )
}
