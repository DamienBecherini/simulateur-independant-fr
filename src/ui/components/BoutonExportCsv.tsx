// src/ui/components/BoutonExportCsv.tsx

import { FileSpreadsheet } from "lucide-react"
import { Button } from "@/components/ui/button"

/** Bouton « Exporter en CSV » placé près d'un tableau ; `contenu` complète son nom accessible (« … le tableau X »). */
export function BoutonExportCsv({ contenu, onClick }: { contenu: string; onClick: () => void }) {
  return (
    <Button variant="outline" size="sm" className="min-h-9 gap-2 pointer-coarse:min-h-11" aria-label={`Exporter en CSV ${contenu}`} onClick={onClick}>
      <FileSpreadsheet aria-hidden className="size-4" />
      Exporter en CSV
    </Button>
  )
}
