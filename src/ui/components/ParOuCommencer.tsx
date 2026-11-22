// src/ui/components/ParOuCommencer.tsx
// « Par où commencer ? » dans la page : au-dessus d'une simulation vide ou de l'exemple du premier lancement, le même
// contenu que la fenêtre (BibliothequeDuDepart.tsx), sur l'onglet des questions, dans la page plutôt qu'une fenêtre :
// l'encadré de la démo web reste visible. La liste a une hauteur limitée et défile. « Détails » ouvre la fenêtre sur la
// situation ; une situation chargée depuis une question mène à la zone de la page qui y répond. Le bloc se ferme, et ne
// revient plus dans la page (préférence de l'utilisateur) : la fenêtre reste à portée par la barre d'outils. « Partir
// de zéro » l'efface jusqu'au prochain lancement et signale la barre d'outils (useEncartDesQuestions.ts).

import { useId, useState } from "react"
import { X } from "lucide-react"
import { Button } from "@/components/ui/button"
import type { MontageType } from "@/lib/montages/montages"
import { etatInitialDeLaBibliotheque, type EtatDeLaBibliotheque } from "../depart"
import { useChargementConfirme } from "../hooks/useChargementConfirme"
import { BibliothequeDuDepart } from "./BibliothequeDuDepart"
import { ConfirmationDuMontage, DESCRIPTION_DU_DEPART, FenetreDesMontages, TITRE_DU_DEPART } from "./MontagesTypes"
import { BoutonPartirDeZero } from "./PartirDeZero"

interface ParOuCommencerProps {
  /** Charge une situation type (la confirmation a déjà eu lieu si elle était nécessaire). */
  onCharger: (montage: MontageType) => void
  /** Ferme le bloc pour de bon. */
  onFermer: () => void
  /** La simulation en cours serait perdue : charger une situation ou partir de zéro demande d'abord une confirmation. */
  confirmationNecessaire: boolean
  nomDeLaSession: string
}

export function ParOuCommencer({ onCharger, onFermer, confirmationNecessaire, nomDeLaSession }: ParOuCommencerProps) {
  const titre = useId()
  const [bibliotheque, setBibliotheque] = useState<EtatDeLaBibliotheque>(() => etatInitialDeLaBibliotheque("questions"))
  // La situation dont on lit le détail, dans la fenêtre ; `null` : fenêtre fermée.
  const [detail, setDetail] = useState<MontageType | null>(null)
  const chargement = useChargementConfirme(confirmationNecessaire, onCharger)

  return (
    <section id="par-ou-commencer" aria-labelledby={titre} className="print:hidden mx-auto mb-6 w-full max-w-4xl space-y-3 rounded-lg border border-blue-200 bg-white p-4 shadow-sm dark:border-blue-900 dark:bg-slate-900">
      <div className="flex flex-wrap items-start gap-x-3 gap-y-2">
        <div className="min-w-0 flex-[1_1_20rem]">
          <h2 id={titre} className="text-xl font-semibold text-slate-900 dark:text-slate-50">
            {TITRE_DU_DEPART}
          </h2>
          <p className="text-sm text-slate-600 dark:text-slate-300">{DESCRIPTION_DU_DEPART}</p>
        </div>
        <BoutonPartirDeZero confirmationNecessaire={confirmationNecessaire} nomDeLaSession={nomDeLaSession} />
        <Button variant="ghost" size="icon" aria-label={`Fermer « ${TITRE_DU_DEPART} »`} title="Fermer : le bloc ne reviendra pas dans la page ; le bouton « Situations types » de la barre d'outils l'ouvre en fenêtre" onClick={onFermer} className="-mt-1 -mr-1 shrink-0 pointer-coarse:size-11">
          <X />
        </Button>
      </div>
      <BibliothequeDuDepart etat={bibliotheque} onEtat={setBibliotheque} onCharger={chargement.demander} onDetails={setDetail} listeBornee />

      {detail ? <FenetreDesMontages key={detail.id} open onOpenChange={ouverte => !ouverte && setDetail(null)} onCharger={onCharger} confirmationNecessaire={confirmationNecessaire} nomDeLaSession={nomDeLaSession} detailInitial={detail} /> : null}
      <ConfirmationDuMontage montage={chargement.aConfirmer?.montage ?? null} nomDeLaSession={nomDeLaSession} onAnnuler={chargement.annuler} onConfirmer={montage => chargement.charger(montage, chargement.aConfirmer?.reponse)} declencheur={chargement.declencheur} />
    </section>
  )
}
