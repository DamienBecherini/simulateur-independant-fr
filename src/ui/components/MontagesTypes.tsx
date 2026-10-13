// src/ui/components/MontagesTypes.tsx
// « Partir d'une situation type » : la bibliothèque des montages types en cartes, le détail de chacun (ce qu'il
// illustre, ses conditions, ses risques, ses sources), puis son chargement, confirmé quand la simulation en cours
// serait perdue. Les boutons qui ouvrent la fenêtre parlent de « situation type », ce que l'on vient y chercher ;
// dans la fenêtre, chacune reste un « montage ».

import { useRef, useState, type ReactNode, type RefObject } from "react"
import { ChevronLeft, ExternalLink, LayoutTemplate } from "lucide-react"
import { Button, type ButtonProps } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { ConfirmationDeRemplacement } from "./ConfirmationDeRemplacement"
import { ANNEE_DES_MONTAGES } from "@/lib/montages/construction"
import { MONTAGES_TYPES, type MontageType } from "@/lib/montages/montages"

/** Titre de la fenêtre, repris par le bouton qui l'ouvre dans les paramètres et dans une simulation vide. */
const TITRE_DE_LA_FENETRE = "Partir d'une situation type"

interface FenetreDesMontagesProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Charge le montage : la fenêtre est déjà fermée. */
  onCharger: (montage: MontageType) => void
  /** La simulation en cours serait perdue : le chargement demande d'abord une confirmation. */
  confirmationNecessaire: boolean
  nomDeLaSession: string
  /** Le bouton qui ouvre la fenêtre : le focus y revient à la fermeture. */
  boutonDOuverture?: ReactNode
  /** Sans bouton d'ouverture (fenêtre ouverte depuis un menu) : l'élément où le focus revient à la fermeture. */
  declencheur?: RefObject<HTMLElement | null>
}

function Etiquettes({ etiquettes }: { etiquettes: string[] }) {
  return (
    <ul aria-label="Mots-clés" className="flex flex-wrap gap-1.5">
      {etiquettes.map(etiquette => (
        <li key={etiquette} className="rounded-full bg-slate-200 px-2 py-0.5 text-xs font-medium text-slate-800 dark:bg-slate-700 dark:text-slate-100">
          {etiquette}
        </li>
      ))}
    </ul>
  )
}

function CarteDuMontage({ montage, onDetails, onCharger, focus }: { montage: MontageType; onDetails: () => void; onCharger: () => void; focus: boolean }) {
  return (
    <li className="flex flex-col gap-3 rounded-lg border bg-slate-50 p-4 dark:bg-gray-900">
      <h3 className="font-semibold">
        {montage.titre}
      </h3>
      <p className="text-sm text-slate-700 dark:text-slate-300">{montage.resume}</p>
      <Etiquettes etiquettes={montage.etiquettes} />
      <div className="mt-auto flex flex-wrap gap-2 pt-1">
        <Button variant="outline" size="sm" onClick={onDetails} autoFocus={focus} aria-label={`Détails du montage « ${montage.titre} »`}>
          Détails
        </Button>
        <Button size="sm" onClick={onCharger} aria-label={`Charger le montage « ${montage.titre} »`}>
          Charger
        </Button>
      </div>
    </li>
  )
}

function Rubrique({ titre, elements }: { titre: string; elements: string[] }) {
  return (
    <section>
      <h3 className="mb-1.5 font-semibold">{titre}</h3>
      <ul className="list-disc space-y-1 pl-5 text-sm text-slate-700 dark:text-slate-300">
        {elements.map(element => (
          <li key={element}>{element}</li>
        ))}
      </ul>
    </section>
  )
}

function DetailDuMontage({ montage, onRetour, onCharger }: { montage: MontageType; onRetour: () => void; onCharger: () => void }) {
  return (
    <>
      <DialogHeader>
        {/* Le détail remplace la liste : le focus passe sur le retour, et y reviendra sur la carte du montage. */}
        <Button variant="ghost" size="sm" onClick={onRetour} autoFocus className="-ml-2 self-start">
          <ChevronLeft /> Tous les montages
        </Button>
        <DialogTitle>{montage.titre}</DialogTitle>
        <DialogDescription>{montage.resume}</DialogDescription>
      </DialogHeader>
      <Etiquettes etiquettes={montage.etiquettes} />
      <div className="space-y-4">
        <Rubrique titre="Questions auxquelles il répond" elements={montage.questions} />
        <Rubrique titre="Ce que ce montage illustre" elements={montage.illustre} />
        <Rubrique titre="Conditions" elements={montage.conditions} />
        <Rubrique titre="Points d'attention et risques" elements={montage.pointsDAttention} />
        <section>
          <h3 className="mb-1.5 font-semibold">Sources officielles</h3>
          <ul className="space-y-1 text-sm">
            {montage.sources.map(source => (
              <li key={source.url}>
                <a href={source.url} target="_blank" rel="noreferrer" className="text-blue-700 underline underline-offset-2 hover:no-underline dark:text-blue-300">
                  {source.libelle}
                  <ExternalLink aria-hidden="true" className="ml-1 inline size-3.5 align-[-2px]" />
                  <span className="sr-only"> (nouvelle fenêtre)</span>
                </a>
              </li>
            ))}
          </ul>
        </section>
        <p className="text-xs text-slate-600 dark:text-slate-400">Chiffres fictifs, calculés avec les règles {ANNEE_DES_MONTAGES} du simulateur : des estimations simplifiées, à adapter à votre situation et à vérifier avec un professionnel.</p>
      </div>
      <DialogFooter className="gap-2">
        <Button variant="outline" onClick={onRetour}>
          Retour
        </Button>
        <Button onClick={onCharger}>Charger ce montage</Button>
      </DialogFooter>
    </>
  )
}

function ListeDesMontages({ onDetails, onCharger, montageVu }: { onDetails: (montage: MontageType) => void; onCharger: (montage: MontageType) => void; montageVu: string | null }) {
  return (
    <>
      <DialogHeader>
        <DialogTitle>{TITRE_DE_LA_FENETRE}</DialogTitle>
        <DialogDescription>Des simulations d'une année, préremplies avec des chiffres fictifs, à charger puis à adapter. Chacune explique ce qu'elle illustre, ses conditions et ses risques.</DialogDescription>
      </DialogHeader>
      <ul aria-label="Situations types" className="grid gap-3 sm:grid-cols-2">
        {MONTAGES_TYPES.map(montage => (
          <CarteDuMontage key={montage.id} montage={montage} onDetails={() => onDetails(montage)} onCharger={() => onCharger(montage)} focus={montage.id === montageVu} />
        ))}
      </ul>
    </>
  )
}

/** La fenêtre des montages types, et la confirmation avant de remplacer une simulation non enregistrée. */
export function FenetreDesMontages({ open, onOpenChange, onCharger, confirmationNecessaire, nomDeLaSession, boutonDOuverture, declencheur: declencheurDeLaFenetre }: FenetreDesMontagesProps) {
  const [detail, setDetail] = useState<MontageType | null>(null)
  // Dernier montage dont on a vu le détail : de retour à la liste, le focus revient sur sa carte.
  const [montageVu, setMontageVu] = useState<string | null>(null)
  const [aConfirmer, setAConfirmer] = useState<MontageType | null>(null)
  // Bouton qui a demandé la confirmation : « Annuler » y ramène le focus.
  const declencheur = useRef<HTMLElement | null>(null)

  const changerOuverture = (ouverte: boolean) => {
    if (!ouverte) {
      setDetail(null)
      setMontageVu(null)
    }
    onOpenChange(ouverte)
  }
  const charger = (montage: MontageType) => {
    setAConfirmer(null)
    changerOuverture(false)
    onCharger(montage)
  }
  const voirLeDetail = (montage: MontageType) => {
    setDetail(montage)
    setMontageVu(montage.id)
  }
  const demanderLeChargement = (montage: MontageType) => {
    if (!confirmationNecessaire) return charger(montage)
    declencheur.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
    setAConfirmer(montage)
  }

  return (
    <>
      <Dialog open={open} onOpenChange={changerOuverture}>
        {boutonDOuverture ? <DialogTrigger asChild>{boutonDOuverture}</DialogTrigger> : null}
        <DialogContent
          className="max-h-[90vh] overflow-y-auto sm:max-w-3xl"
          onCloseAutoFocus={event => {
            if (!declencheurDeLaFenetre?.current) return
            event.preventDefault()
            declencheurDeLaFenetre.current.focus()
          }}
        >
          {detail ? <DetailDuMontage montage={detail} onRetour={() => setDetail(null)} onCharger={() => demanderLeChargement(detail)} /> : <ListeDesMontages onDetails={voirLeDetail} onCharger={demanderLeChargement} montageVu={montageVu} />}
        </DialogContent>
      </Dialog>

      <ConfirmationDuMontage montage={aConfirmer} nomDeLaSession={nomDeLaSession} onAnnuler={() => setAConfirmer(null)} onConfirmer={charger} declencheur={declencheur} />
    </>
  )
}

interface ConfirmationDuMontageProps {
  /** Le montage à charger ; `null` : pas de confirmation en cours. */
  montage: MontageType | null
  nomDeLaSession: string
  onAnnuler: () => void
  onConfirmer: (montage: MontageType) => void
  /** Bouton qui a demandé la confirmation : le focus y revient à la fermeture. */
  declencheur: RefObject<HTMLElement | null>
}

/** La confirmation avant qu'un montage ne remplace une simulation non enregistrée (fenêtre des montages, questions). */
export function ConfirmationDuMontage({ montage, nomDeLaSession, onAnnuler, onConfirmer, declencheur }: ConfirmationDuMontageProps) {
  return (
    <ConfirmationDeRemplacement open={montage !== null} onAnnuler={onAnnuler} onConfirmer={() => montage && onConfirmer(montage)} titre="Remplacer la simulation en cours ?" libelleDeConfirmation="Remplacer" declencheur={declencheur}>
      « {nomDeLaSession} » n'est pas enregistrée dans une sauvegarde. Le montage « {montage?.titre} » la remplacera ; le bouton « Annuler » de la barre d'outils la rétablira.
    </ConfirmationDeRemplacement>
  )
}

/** Le bouton « Partir d'une situation type », qui ouvre la fenêtre des montages. */
export function BoutonDesMontages({ children, ...props }: Omit<FenetreDesMontagesProps, "open" | "onOpenChange"> & Pick<ButtonProps, "variant" | "size" | "className" | "aria-label"> & { children?: ReactNode }) {
  const [ouverte, setOuverte] = useState(false)
  const { onCharger, confirmationNecessaire, nomDeLaSession, ...bouton } = props
  return (
    <FenetreDesMontages
      open={ouverte}
      onOpenChange={setOuverte}
      onCharger={onCharger}
      confirmationNecessaire={confirmationNecessaire}
      nomDeLaSession={nomDeLaSession}
      boutonDOuverture={
        <Button {...bouton}>
          <LayoutTemplate /> {children ?? `${TITRE_DE_LA_FENETRE}...`}
        </Button>
      }
    />
  )
}
