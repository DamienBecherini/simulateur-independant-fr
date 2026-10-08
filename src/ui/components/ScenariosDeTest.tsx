// src/ui/components/ScenariosDeTest.tsx
// Fenêtre « Scénarios de test », en mode développement seulement (voir BoutonDesTests.tsx, qui la charge à la
// demande) : chaque scénario remplace la session, comme un montage type, et dit ce qu'il faut vérifier.

import { useState } from "react"
import { FlaskConical } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { SCENARIOS_DE_TEST } from "@/lib/scenarios-de-test"
import type { SessionState } from "@/types"

export const TITRE_DES_TESTS = "Scénarios de test"

export interface ScenariosDeTestProps {
  /** Remplace la session par celle du scénario (nouvel historique). */
  onCharger: (session: SessionState) => void
}

export default function ScenariosDeTest({ onCharger }: ScenariosDeTestProps) {
  const [ouverte, setOuverte] = useState(false)
  const charger = (session: SessionState) => {
    setOuverte(false)
    onCharger(session)
  }
  return (
    <Dialog open={ouverte} onOpenChange={setOuverte}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" aria-label={TITRE_DES_TESTS} title={`${TITRE_DES_TESTS} (développement)`} className="ml-1 h-8 gap-2 border-dashed pointer-coarse:min-w-11 max-[22rem]:hidden sm:ml-2">
          <FlaskConical />
          <span className="hidden md:inline">Tests</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>{TITRE_DES_TESTS}</DialogTitle>
          <DialogDescription>Mode développement seulement. Charger un scénario remplace la simulation en cours, sans confirmation.</DialogDescription>
        </DialogHeader>
        <ul aria-label={TITRE_DES_TESTS} className="space-y-3">
          {SCENARIOS_DE_TEST.map(scenario => (
            <li key={scenario.id} className="space-y-2 rounded-md border p-3 text-sm">
              <h3 className="font-semibold text-slate-800 dark:text-slate-100">{scenario.titre}</h3>
              <p className="text-slate-600 dark:text-slate-400">{scenario.resume}</p>
              <p className="font-medium">À vérifier :</p>
              <ol className="list-decimal space-y-1 pl-5">
                {scenario.aVerifier.map(point => (
                  <li key={point}>{point}</li>
                ))}
              </ol>
              <Button type="button" size="sm" onClick={() => charger(scenario.session())} aria-label={`Charger le scénario « ${scenario.titre} »`}>
                Charger ce scénario
              </Button>
            </li>
          ))}
        </ul>
      </DialogContent>
    </Dialog>
  )
}
