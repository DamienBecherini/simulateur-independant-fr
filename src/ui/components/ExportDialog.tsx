// src/ui/components/ExportDialog.tsx
// Fenêtre « Exporter » : un bouton par format, regroupés par usage. Chaque format est produit par une fonction pure
// de src/lib, puis enregistré par window.api (fenêtre d'enregistrement dans Electron, téléchargement dans le navigateur).

import type { ReactNode } from "react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import type { SessionState, SimulationReport } from "@/types"
import { exporterGrilleCsv, exporterRapportMarkdown, exporterResultatsCsv } from "../exports-texte"
import { nomDuPdf } from "@/lib/nom-du-pdf"
import { exporterEnPdf } from "../impression"

interface ExportDialogProps {
  isOpen: boolean
  onClose: () => void
  session: SessionState
  simulationReport: SimulationReport | null
  /** Export complet de la simulation, réimportable (JSON). */
  onExportJson: () => void
}

/** Un format d'export : son nom, ce qu'il contient, et l'action qui le produit. */
export function OptionExport({ titre, description, onClick }: { titre: string; description: string; onClick: () => void }) {
  return (
    <li>
      <button type="button" onClick={onClick} className="w-full rounded-md border border-slate-200 px-4 py-3 text-left hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600 dark:border-slate-700 dark:hover:bg-slate-800">
        <span className="block font-medium">{titre}</span>
        <span className="block text-sm text-slate-600 dark:text-slate-300">{description}</span>
      </button>
    </li>
  )
}

function Groupe({ titre, children }: { titre: string; children: ReactNode }) {
  return (
    <section className="space-y-2" aria-label={titre}>
      <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200">{titre}</h3>
      <ul className="space-y-2">{children}</ul>
    </section>
  )
}

/** Le PDF porte le nom de la simulation et l'année de ses règles fiscales (l'année en cours tant qu'elle n'est pas calculée). */
function exporterLaSimulationEnPdf(session: SessionState, simulationReport: SimulationReport | null) {
  exporterEnPdf(nomDuPdf(session.name, simulationReport?.annee ?? new Date().getFullYear())).catch(console.error)
}

export function ExportDialog({ isOpen, onClose, session, simulationReport, onExportJson }: ExportDialogProps) {
  const exporter = (action: () => void) => () => {
    action()
    onClose()
  }

  return (
    <Dialog open={isOpen} onOpenChange={open => !open && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Exporter</DialogTitle>
          <DialogDescription>Pour présenter les chiffres, les transmettre ou les faire analyser.</DialogDescription>
        </DialogHeader>
        <div className="space-y-5">
          <Groupe titre="Sauvegarde">
            <OptionExport titre="Simulation complète (JSON)" description="Acteurs, relations, flux et résultats ; se réimporte dans le simulateur." onClick={exporter(onExportJson)} />
          </Groupe>
          <Groupe titre="Document">
            <OptionExport titre="Document PDF" description="La simulation mise en page sur A4 : acteurs, grille annuelle, résultats et comparateur." onClick={exporter(() => exporterLaSimulationEnPdf(session, simulationReport))} />
          </Groupe>
          <Groupe titre="Tableur (CSV)">
            <OptionExport titre="Grille mensuelle (CSV)" description="Une ligne par acteur et par type de flux : les douze mois et le total de l'année." onClick={exporter(() => exporterGrilleCsv(session, simulationReport))} />
            <OptionExport titre="Résultats (CSV)" description="Bilan, puis résultats par activité, par personne et par foyer fiscal." onClick={exporter(() => exporterResultatsCsv(session, simulationReport))} />
          </Groupe>
          <Groupe titre="Pour une IA (Markdown)">
            <OptionExport titre="Rapport complet (Markdown)" description="Hypothèses, acteurs, flux, résultats et comparateur, en un texte à lire ou à confier à un assistant conversationnel." onClick={exporter(() => exporterRapportMarkdown(session, simulationReport))} />
          </Groupe>
        </div>
      </DialogContent>
    </Dialog>
  )
}
