// src/ui/components/AjouterUnConjoint.tsx
// « Ajouter un conjoint » sur la carte d'un foyer d'une seule personne : son prénom, le lien (marié ou pacsé) et son
// salaire net mensuel, facultatif. Tout s'ajoute en une étape d'annulation (src/lib/conjoint.ts) ; le foyer passe à
// deux parts et l'impôt se calcule sur les revenus des deux.

import { useId, useState } from "react"
import { UserPlus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import type { ChoixDuConjoint, LienDuConjoint } from "@/lib/conjoint"
import { ChampNumerique } from "./ChampNumerique"

/** Ce que la carte d'un foyer reçoit pour proposer le raccourci : les personnes qui peuvent en bénéficier, et l'ajout. */
export interface AjoutDuConjoint {
  personnes: ReadonlySet<string>
  /** Année dont la grille reçoit le salaire. */
  annee: number
  ajouter: (personneId: string, choix: ChoixDuConjoint) => void
}

const LIENS: readonly { valeur: LienDuConjoint; libelle: string }[] = [
  { valeur: "Marié(e)", libelle: "Marié(e)" },
  { valeur: "PACSé(e)", libelle: "Pacsé(e)" }
]

interface FenetreProps {
  ouverte: boolean
  onFermer: () => void
  nomDeLaPersonne: string
  annee: number
  onAjouter: (choix: ChoixDuConjoint) => void
}

function FenetreDuConjoint({ ouverte, onFermer, nomDeLaPersonne, annee, onAjouter }: FenetreProps) {
  const [prenom, setPrenom] = useState("")
  const [lien, setLien] = useState<LienDuConjoint>("Marié(e)")
  const [salaire, setSalaire] = useState("")
  const id = useId()
  // À chaque ouverture, la fenêtre repart vide (mise à jour pendant le rendu plutôt que dans un effet).
  const [etaitOuverte, setEtaitOuverte] = useState(ouverte)
  if (etaitOuverte !== ouverte) {
    setEtaitOuverte(ouverte)
    if (ouverte) {
      setPrenom("")
      setLien("Marié(e)")
      setSalaire("")
    }
  }
  const montant = salaire === "" ? 0 : Number(salaire.replace(",", "."))
  const salaireValide = Number.isFinite(montant) && montant >= 0

  return (
    <Dialog open={ouverte} onOpenChange={o => (o ? undefined : onFermer())}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Ajouter le conjoint de {nomDeLaPersonne}</DialogTitle>
          <DialogDescription>Mariés ou pacsés, vous formez un seul foyer fiscal : l'impôt sur le revenu se calcule sur vos revenus à tous les deux, sur deux parts.</DialogDescription>
        </DialogHeader>
        <form
          className="space-y-4 pt-2"
          onSubmit={evenement => {
            evenement.preventDefault()
            if (!salaireValide) return
            onAjouter({ prenom, lien, salaireMensuel: montant })
            onFermer()
          }}
        >
          <div className="space-y-1">
            <label htmlFor={`${id}-prenom`} className="text-sm font-medium">
              Prénom
            </label>
            <Input id={`${id}-prenom`} value={prenom} onChange={e => setPrenom(e.target.value)} placeholder="Conjoint" autoComplete="off" />
          </div>
          <fieldset>
            <legend className="mb-1 text-sm font-medium">Vous êtes</legend>
            <div className="flex gap-2">
              {LIENS.map(({ valeur, libelle }) => (
                <label key={valeur} className="flex flex-1 cursor-pointer items-center gap-2 rounded-md border px-3 py-2 hover:bg-slate-50 dark:hover:bg-gray-800 pointer-coarse:min-h-11">
                  <input type="radio" name={`${id}-lien`} value={valeur} checked={lien === valeur} onChange={() => setLien(valeur)} className="size-4 shrink-0 pointer-coarse:size-5" />
                  {libelle}
                </label>
              ))}
            </div>
          </fieldset>
          <div className="space-y-1">
            <label htmlFor={`${id}-salaire`} className="text-sm font-medium">
              Son salaire net par mois (€), facultatif
            </label>
            <ChampNumerique id={`${id}-salaire`} value={salaire} onChange={e => setSalaire(e.target.value)} min={0} step="any" pas={100} quoi="le salaire" aria-describedby={`${id}-salaire-aide`} aria-invalid={!salaireValide || undefined} />
            <p id={`${id}-salaire-aide`} className="text-sm text-slate-600 dark:text-slate-400">
              Le net imposable, chaque mois de {annee}. Il se modifie ensuite dans la grille ; ses autres revenus (chômage, activité) s'y ajoutent aussi.
            </p>
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={onFermer}>
              Annuler
            </Button>
            <Button type="submit" disabled={!salaireValide}>
              Ajouter au foyer
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

/** Le bouton de la carte du foyer, et sa fenêtre. */
export function BoutonAjouterUnConjoint({ personneId, nomDeLaPersonne, ajout }: { personneId: string; nomDeLaPersonne: string; ajout: AjoutDuConjoint }) {
  const [ouverte, setOuverte] = useState(false)
  return (
    <>
      <Button type="button" variant="outline" className="mt-3 print:hidden" onClick={() => setOuverte(true)}>
        <UserPlus aria-hidden="true" className="size-4" />
        Ajouter un conjoint
      </Button>
      <FenetreDuConjoint ouverte={ouverte} onFermer={() => setOuverte(false)} nomDeLaPersonne={nomDeLaPersonne} annee={ajout.annee} onAjouter={choix => ajout.ajouter(personneId, choix)} />
    </>
  )
}
