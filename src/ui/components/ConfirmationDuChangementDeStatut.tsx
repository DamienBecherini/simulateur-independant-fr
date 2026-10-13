// src/ui/components/ConfirmationDuChangementDeStatut.tsx
// Confirmation d'un changement de statut demandé depuis la fiche d'une activité : ce que la conversion change, garde ou
// retire, dit avant de valider ; ou, si le statut est interdit à la profession, pourquoi.

import { useId, useState } from "react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import type { Activite } from "@/backend/logic/conversion-de-statut"
import { examinerLeChangement, natureProposee, nomDuStatut, type ExamenDuChangement, type NatureDesPrestations, type StatutDUneActivite } from "@/lib/changement-de-statut"
import { reglesDeLAnneeAffichee } from "@/lib/regles-affichees"
import type { SessionState } from "@/types"

/** Identifiant de la liste « Statut » de la fiche : le focus y revient à la fermeture de la confirmation. */
export const ID_DU_CHAMP_STATUT = "statut-de-l-activite"

/** Un changement demandé : la session telle que la fiche la modifie, l'activité en cours de modification et le statut voulu. */
export interface DemandeDeChangement {
  session: SessionState
  activite: Activite
  cible: StatutDUneActivite
}

interface ConfirmationDuChangementDeStatutProps {
  demande: DemandeDeChangement | null
  /** L'année affichée : la profession et son éventuel refus de la micro-entreprise se lisent dans ses règles. */
  annee: number
  onAnnuler: () => void
  onConfirmer: (nature: NatureDesPrestations) => void
}

const NATURES: { valeur: NatureDesPrestations; libelle: string }[] = [
  { valeur: "bnc", libelle: "Prestations libérales (BNC)" },
  { valeur: "bic", libelle: "Prestations commerciales ou artisanales (BIC)" }
]

/** Le choix de la nature des prestations de services, qui fixe le taux de la micro-entreprise. */
function ChoixDeLaNature({ nature, onChange }: { nature: NatureDesPrestations; onChange: (nature: NatureDesPrestations) => void }) {
  const id = useId()
  return (
    <fieldset className="rounded-md border px-3 py-2 text-sm">
      <legend className="px-1 font-medium">En micro-entreprise, vos prestations de services sont :</legend>
      {NATURES.map(({ valeur, libelle }) => (
        <div key={valeur} className="flex items-center gap-2 py-0.5">
          <input id={`${id}-${valeur}`} type="radio" name={`${id}-nature`} className="size-4 shrink-0 cursor-pointer pointer-coarse:size-5" checked={nature === valeur} onChange={() => onChange(valeur)} />
          <label htmlFor={`${id}-${valeur}`} className="cursor-pointer">
            {libelle}
          </label>
        </div>
      ))}
    </fieldset>
  )
}

function titreDeLaConfirmation({ activite, cible }: DemandeDeChangement, examen: ExamenDuChangement): string {
  return examen.refus ? `« ${activite.name} » ne peut pas devenir une micro-entreprise` : `Passer « ${activite.name} » en ${nomDuStatut(cible)} ?`
}

/** Convertir ou annuler ; un refus n'a que « Retour à la fiche ». */
function BoutonsDeLaConfirmation({ refus, onAnnuler, onConfirmer }: { refus: boolean; onAnnuler: () => void; onConfirmer: () => void }) {
  return (
    <DialogFooter className="gap-2">
      {refus ? (
        <Button onClick={onAnnuler}>Retour à la fiche</Button>
      ) : (
        <>
          <Button variant="outline" onClick={onAnnuler}>
            Annuler
          </Button>
          <Button onClick={onConfirmer}>Convertir</Button>
        </>
      )}
    </DialogFooter>
  )
}

export function ConfirmationDuChangementDeStatut({ demande, annee, onAnnuler, onConfirmer }: ConfirmationDuChangementDeStatutProps) {
  // La nature proposée repart de celle de l'activité à chaque nouvelle demande (mise à jour pendant le rendu).
  const [nature, setNature] = useState<NatureDesPrestations>("bnc")
  const [demandeVue, setDemandeVue] = useState<DemandeDeChangement | null>(null)
  if (demande !== demandeVue) {
    setDemandeVue(demande)
    if (demande) setNature(natureProposee(demande.session, demande.activite.id))
  }

  const examen = demande ? examinerLeChangement(demande.session, demande.activite, demande.cible, reglesDeLAnneeAffichee(annee), nature) : null
  const titre = demande && examen ? titreDeLaConfirmation(demande, examen) : ""

  return (
    <Dialog open={demande !== null} onOpenChange={ouverte => !ouverte && onAnnuler()}>
      <DialogContent
        className="sm:max-w-lg"
        onCloseAutoFocus={evenement => {
          // Le focus revient à la liste « Statut » de la fiche, qui reste ouverte.
          evenement.preventDefault()
          document.getElementById(ID_DU_CHAMP_STATUT)?.focus()
        }}
      >
        <DialogHeader>
          <DialogTitle className="leading-snug">{titre}</DialogTitle>
          <DialogDescription>{examen?.refus ?? "La conversion reprend l'activité, ses flux de toutes les années et ses relations. Elle est enregistrée dès que vous confirmez, avec les autres modifications de la fiche ; « Annuler » (Ctrl+Z) la défait en une étape."}</DialogDescription>
        </DialogHeader>
        {examen && !examen.refus ? (
          <div className="max-h-[50vh] space-y-3 overflow-y-auto pr-2">
            {examen.prestationsAQualifier ? <ChoixDeLaNature nature={nature} onChange={setNature} /> : null}
            <ul aria-label="Ce que la conversion change" className="list-disc space-y-1 pl-5 text-sm">
              {examen.consequences.map(phrase => (
                <li key={phrase}>{phrase}</li>
              ))}
            </ul>
          </div>
        ) : null}
        <BoutonsDeLaConfirmation refus={Boolean(examen?.refus)} onAnnuler={onAnnuler} onConfirmer={() => onConfirmer(nature)} />
      </DialogContent>
    </Dialog>
  )
}
