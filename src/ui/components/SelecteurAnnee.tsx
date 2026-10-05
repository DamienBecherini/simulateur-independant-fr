// src/ui/components/SelecteurAnnee.tsx
// Choix de l'année affichée (grille, résultats, comparateur, exports), ajout d'une année avant la plus ancienne ou
// après la plus récente, et suppression de l'une des deux extrémités : les années de la session restent consécutives.
// Une session compte au plus NOMBRE_MAX_ANNEES années : l'ajout est alors désactivé, et l'interface dit pourquoi.

import { useId, useState } from "react"
import { Plus, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { NOMBRE_MAX_ANNEES, type PositionNouvelleAnnee } from "@/backend/logic/annees"
import { cn } from "@/lib/utils"

interface SelecteurAnneeProps {
  /** Années de la session, de la plus ancienne à la plus récente. */
  annees: number[]
  /** Année affichée. */
  annee: number
  /** Première année dont le simulateur connaît les règles : on n'ajoute pas d'année avant elle. */
  premiereAnneeConnue: number
  onChange: (annee: number) => void
  onAjouter: (position: PositionNouvelleAnnee, copier: boolean) => void
  onSupprimer: (annee: number) => void
}

/** Une option de la fenêtre d'ajout : un bouton radio dans une étiquette assez haute pour être une bonne cible. */
function Option({ name, checked, disabled = false, onChange, children }: { name: string; checked: boolean; disabled?: boolean; onChange: () => void; children: string }) {
  return (
    <label className={cn("flex min-h-11 cursor-pointer items-center gap-3 rounded-md border px-3 py-2 text-sm", checked ? "border-blue-600 bg-blue-50 dark:border-blue-400 dark:bg-blue-950/40" : "border-slate-200 dark:border-slate-700", disabled && "cursor-not-allowed opacity-60")}>
      <input type="radio" name={name} checked={checked} disabled={disabled} onChange={onChange} className="size-4 accent-blue-600" />
      {children}
    </label>
  )
}

/** Fenêtre d'ajout d'une année : avant ou après, grille vide ou recopiée de l'année voisine. */
function FenetreAjout({ annees, premiereAnneeConnue, onClose, onAjouter }: Pick<SelecteurAnneeProps, "annees" | "premiereAnneeConnue" | "onAjouter"> & { onClose: () => void }) {
  const premiere = annees[0]
  const derniere = annees[annees.length - 1]
  const avantPossible = premiere - 1 >= premiereAnneeConnue
  const [position, setPosition] = useState<PositionNouvelleAnnee>("apres")
  const [copier, setCopier] = useState(true)
  const voisine = position === "apres" ? derniere : premiere

  return (
    <Dialog open onOpenChange={ouverte => !ouverte && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Ajouter une année</DialogTitle>
          <DialogDescription>Les acteurs et les relations sont communs à toutes les années ; seule la grille des flux change.</DialogDescription>
        </DialogHeader>
        <fieldset className="space-y-2">
          <legend className="mb-2 text-sm font-medium">Année</legend>
          <Option name="position" checked={position === "apres"} onChange={() => setPosition("apres")}>{`${derniere + 1}, après ${derniere}`}</Option>
          <Option name="position" checked={position === "avant"} disabled={!avantPossible} onChange={() => setPosition("avant")}>
            {avantPossible ? `${premiere - 1}, avant ${premiere}` : `Pas d'année avant ${premiere} : les règles d'avant ${premiereAnneeConnue} ne sont pas connues`}
          </Option>
        </fieldset>
        <fieldset className="space-y-2">
          <legend className="mb-2 text-sm font-medium">Flux</legend>
          <Option name="contenu" checked={copier} onChange={() => setCopier(true)}>{`Recopier les flux de ${voisine}`}</Option>
          <Option name="contenu" checked={!copier} onChange={() => setCopier(false)}>Commencer avec une grille vide</Option>
        </fieldset>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Annuler
          </Button>
          <Button
            onClick={() => {
              onAjouter(position, copier)
              onClose()
            }}
          >
            Ajouter {position === "apres" ? derniere + 1 : premiere - 1}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/** Fenêtre de confirmation avant de supprimer une année et ses flux. */
function FenetreSuppression({ annee, onClose, onSupprimer }: { annee: number; onClose: () => void; onSupprimer: (annee: number) => void }) {
  return (
    <Dialog open onOpenChange={ouverte => !ouverte && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Supprimer l'année {annee} ?</DialogTitle>
          <DialogDescription>Sa grille et tous ses flux sont supprimés. Les acteurs et les relations restent. Ctrl+Z pour annuler.</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Garder {annee}
          </Button>
          <Button
            variant="destructive"
            onClick={() => {
              onSupprimer(annee)
              onClose()
            }}
          >
            Supprimer {annee}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/** Pourquoi on ne peut plus ajouter d'année, affiché sous le sélecteur une fois la limite atteinte. */
const EXPLICATION_LIMITE = `${NOMBRE_MAX_ANNEES} années au plus : au-delà de deux ou trois ans après les dernières règles connues, les chiffres ne sont plus qu'une projection. Supprimez la première ou la dernière année pour en ajouter une autre.`

export function SelecteurAnnee({ annees, annee, premiereAnneeConnue, onChange, onAjouter, onSupprimer }: SelecteurAnneeProps) {
  const [fenetre, setFenetre] = useState<"ajout" | "suppression" | null>(null)
  const idExplication = useId()
  // Seules la plus ancienne et la plus récente se suppriment, et jamais la dernière qui reste.
  const supprimable = annees.length > 1 && (annee === annees[0] || annee === annees[annees.length - 1])
  // Au-delà de NOMBRE_MAX_ANNEES, le bouton d'ajout est désactivé et l'explication, visible, lui est associée.
  const limiteAtteinte = annees.length >= NOMBRE_MAX_ANNEES

  return (
    <div className="flex min-w-0 flex-wrap items-center gap-2 print:hidden">
      <div role="group" aria-label="Année affichée" className="flex flex-wrap gap-1">
        {annees.map(a => (
          <Button key={a} size="sm" variant={a === annee ? "default" : "outline"} aria-pressed={a === annee} className="min-w-14 text-sm" onClick={() => onChange(a)}>
            {a}
          </Button>
        ))}
      </div>
      <Button size="sm" variant="ghost" className="text-sm" disabled={limiteAtteinte} aria-describedby={limiteAtteinte ? idExplication : undefined} title={limiteAtteinte ? EXPLICATION_LIMITE : undefined} onClick={() => setFenetre("ajout")}>
        <Plus aria-hidden="true" />
        Ajouter une année
      </Button>
      {supprimable ? (
        <Button size="sm" variant="ghost" className="text-sm text-rose-700 hover:text-rose-800 dark:text-rose-400 dark:hover:text-rose-300" onClick={() => setFenetre("suppression")}>
          <Trash2 aria-hidden="true" />
          Supprimer {annee}
        </Button>
      ) : null}
      {limiteAtteinte ? (
        <p id={idExplication} className="basis-full text-sm text-slate-600 dark:text-slate-400">
          {EXPLICATION_LIMITE}
        </p>
      ) : null}
      {fenetre === "ajout" ?<FenetreAjout annees={annees} premiereAnneeConnue={premiereAnneeConnue} onClose={() => setFenetre(null)} onAjouter={onAjouter} /> : null}
      {fenetre === "suppression" ? <FenetreSuppression annee={annee} onClose={() => setFenetre(null)} onSupprimer={onSupprimer} /> : null}
    </div>
  )
}
