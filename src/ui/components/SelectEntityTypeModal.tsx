// src/ui/components/SelectEntityTypeModal.tsx
// Fenêtre « Ajouter une activité », en deux temps : le statut, puis qui exerce l'activité, pour la relier dès sa
// création (sans relation, son revenu ne rejoint aucun foyer).

import { useEffect, useRef, useState, type ReactNode } from "react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Briefcase, Building, Store, User } from "lucide-react"
import { relationDuDirigeant } from "@/backend/logic/conversion-de-statut"
import type { Exercant } from "@/lib/entity-factory"
import type { StatutDUneActivite } from "@/lib/changement-de-statut"
import type { Person } from "@/types"

interface SelectEntityTypeModalProps {
  isOpen: boolean
  onClose: () => void
  /** Les personnes de la simulation, à qui l'activité peut être reliée. */
  personnes: Person[]
  onSelect: (statut: StatutDUneActivite, exercant: Exercant) => void
}

interface OptionDActivite {
  label: string
  description: string
  icon: ReactNode
}

/** Le choix proposé pour chaque activité, dans l'ordre d'affichage. Un nouveau statut doit y avoir le sien. */
const OPTIONS_PAR_TYPE: Record<StatutDUneActivite, OptionDActivite> = {
  micro: { label: "Micro-Entreprise", description: "Entreprise individuelle au régime simplifié, charges forfaitaires.", icon: <Store className="h-8 w-8 text-blue-500" /> },
  EI: { label: "Entreprise individuelle (au réel)", description: "Charges réelles déduites, bénéfice imposé à l'impôt sur le revenu.", icon: <User className="h-8 w-8 text-violet-500" /> },
  SASU: { label: "SASU (à l'IS)", description: "Société par actions, dirigeant assimilé-salarié.", icon: <Briefcase className="h-8 w-8 text-red-500" /> },
  EURL: { label: "EURL (à l'IS)", description: "Société à responsabilité limitée, gérant TNS.", icon: <Building className="h-8 w-8 text-green-500" /> }
}

const entityOptions = (Object.keys(OPTIONS_PAR_TYPE) as StatutDUneActivite[]).map(type => ({ type, ...OPTIONS_PAR_TYPE[type] }))

/** Valeurs du choix « Qui exerce cette activité ? » autres qu'une personne de la simulation. */
const NOUVELLE_PERSONNE = "nouvelle-personne"
const PERSONNE_POUR_L_INSTANT = "personne-pour-l-instant"

/** Le choix proposé d'office : la seule personne de la simulation, une nouvelle personne s'il n'y en a aucune, rien sinon. */
function choixProposeDOffice(personnes: Person[]): string {
  if (personnes.length === 1) return personnes[0].id
  return personnes.length === 0 ? NOUVELLE_PERSONNE : ""
}

function exercantDuChoix(choix: string): Exercant {
  if (choix === PERSONNE_POUR_L_INSTANT) return null
  return choix === NOUVELLE_PERSONNE ? "nouvelle personne" : { personneId: choix }
}

/** Premier temps : les statuts, un bouton chacun. Au retour du second temps, le focus revient au statut choisi. */
function ChoixDuStatut({ onChoisir, precedent }: { onChoisir: (statut: StatutDUneActivite) => void; precedent: StatutDUneActivite | null }) {
  const liste = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (precedent) liste.current?.querySelector<HTMLButtonElement>(`[data-statut="${precedent}"]`)?.focus()
  }, [precedent])
  return (
    <div ref={liste} className="flex flex-col space-y-3 pt-4">
      {entityOptions.map(option => (
        <button key={option.type} type="button" data-statut={option.type} onClick={() => onChoisir(option.type)} className="flex items-center space-x-4 p-4 border rounded-lg text-left hover:bg-slate-50 dark:hover:bg-gray-800 transition-colors">
          {option.icon}
          <div>
            <p className="font-semibold">{option.label}</p>
            <p className="text-sm text-slate-600 dark:text-slate-400">{option.description}</p>
          </div>
        </button>
      ))}
    </div>
  )
}

interface ChoixDeLaPersonneProps {
  statut: StatutDUneActivite
  personnes: Person[]
  choix: string
  onChoix: (choix: string) => void
  onRetour: () => void
  onAjouter: () => void
}

/** Second temps : qui exerce l'activité, la relation qui en découle, puis l'ajout. */
function ChoixDeLaPersonne({ statut, personnes, choix, onChoix, onRetour, onAjouter }: ChoixDeLaPersonneProps) {
  const options = [...personnes.map(p => ({ valeur: p.id, libelle: p.name })), { valeur: NOUVELLE_PERSONNE, libelle: "Créer une personne" }, { valeur: PERSONNE_POUR_L_INSTANT, libelle: "Personne pour l'instant" }]
  // Ce temps remplace le premier, dont le bouton avait le focus : il va au choix proposé (ou au premier), sinon il serait perdu.
  const formulaire = useRef<HTMLFormElement>(null)
  useEffect(() => {
    formulaire.current?.querySelector<HTMLInputElement>("input[type=radio]:checked, input[type=radio]")?.focus()
  }, [])
  return (
    <form
      ref={formulaire}
      className="space-y-4 pt-2"
      onSubmit={evenement => {
        evenement.preventDefault()
        if (choix !== "") onAjouter()
      }}
    >
      <p className="text-sm">
        Statut : <span className="font-semibold">{OPTIONS_PAR_TYPE[statut].label}</span>
      </p>
      <fieldset aria-describedby="exercant-aide">
        <legend className="mb-2 font-semibold">Qui exerce cette activité ?</legend>
        <div className="space-y-1">
          {options.map(({ valeur, libelle }) => (
            <label key={valeur} className="flex cursor-pointer items-center gap-3 rounded-md border px-3 py-2 hover:bg-slate-50 dark:hover:bg-gray-800 pointer-coarse:min-h-11">
              <input type="radio" name="exercant" value={valeur} checked={choix === valeur} onChange={() => onChoix(valeur)} className="size-4 shrink-0 pointer-coarse:size-5" />
              {libelle}
            </label>
          ))}
        </div>
        <p id="exercant-aide" className="mt-2 text-sm text-slate-600 dark:text-slate-400">
          Elle sera reliée à l'activité comme « {relationDuDirigeant(statut)} » : son revenu rejoint son foyer. Sans personne, le net de l'activité reste à 0 € tant qu'aucune relation n'est ajoutée.
        </p>
      </fieldset>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onRetour}>
          Retour
        </Button>
        <Button type="submit" disabled={choix === ""}>
          Ajouter l'activité
        </Button>
      </div>
    </form>
  )
}

export function SelectEntityTypeModal({ isOpen, onClose, personnes, onSelect }: SelectEntityTypeModalProps) {
  const [statut, setStatut] = useState<StatutDUneActivite | null>(null)
  const [precedent, setPrecedent] = useState<StatutDUneActivite | null>(null)
  const [choix, setChoix] = useState("")
  // À chaque ouverture, la fenêtre repart du choix du statut (mise à jour pendant le rendu plutôt que dans un effet).
  const [ouverte, setOuverte] = useState(isOpen)
  if (ouverte !== isOpen) {
    setOuverte(isOpen)
    setStatut(null)
    setPrecedent(null)
  }

  const choisirLeStatut = (choisi: StatutDUneActivite) => {
    setStatut(choisi)
    setChoix(choixProposeDOffice(personnes))
  }

  const revenir = () => {
    setPrecedent(statut)
    setStatut(null)
  }

  const ajouter = () => {
    if (!statut) return
    onSelect(statut, exercantDuChoix(choix))
    onClose()
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Ajouter une activité</DialogTitle>
          <DialogDescription>{statut ? "Choisissez qui l'exerce : l'activité lui sera reliée." : "Choisissez le statut juridique de l'activité que vous souhaitez simuler."}</DialogDescription>
        </DialogHeader>
        {statut ? <ChoixDeLaPersonne statut={statut} personnes={personnes} choix={choix} onChoix={setChoix} onRetour={revenir} onAjouter={ajouter} /> : <ChoixDuStatut onChoisir={choisirLeStatut} precedent={precedent} />}
      </DialogContent>
    </Dialog>
  )
}
