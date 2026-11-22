// src/ui/components/MontagesTypes.tsx
// La fenêtre « Par où commencer ? » : la bibliothèque des situations types par ses deux onglets, questions et
// situations (BibliothequeDuDepart.tsx), « Partir de zéro », le détail de chaque situation (ce qu'elle illustre, ses
// conditions, ses risques, ses sources), puis son chargement, confirmé quand la simulation en cours serait perdue.
// Chargée depuis une question, la situation mène ensuite à la zone de la page qui y répond (allerALaReponse.ts).
// Les boutons qui ouvrent la fenêtre parlent de « situation type », ce que l'on vient y chercher ; dans le code,
// chacune reste un « montage ».

import { useRef, useState, type ReactNode, type RefObject } from "react"
import { ChevronLeft, ExternalLink, LayoutTemplate } from "lucide-react"
import { Button, type ButtonProps } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { ANNEE_DES_MONTAGES } from "@/lib/montages/construction"
import type { MontageType } from "@/lib/montages/montages"
import { ID_DE_L_AJOUT_D_UNE_PERSONNE } from "@/lib/questions-de-depart"
import { etatInitialDeLaBibliotheque, type EtatDeLaBibliotheque } from "../depart"
import { useChargementConfirme } from "../hooks/useChargementConfirme"
import { BibliothequeDuDepart, Etiquettes } from "./BibliothequeDuDepart"
import { ConfirmationDeRemplacement } from "./ConfirmationDeRemplacement"
import { BoutonPartirDeZero } from "./PartirDeZero"

/** Titre de la fenêtre, et de son équivalent dans la page au premier lancement (ParOuCommencer.tsx). */
export const TITRE_DU_DEPART = "Par où commencer ?"
export const DESCRIPTION_DU_DEPART = "Partez d'une question ou d'une situation type : elle se charge avec des chiffres fictifs, à adapter ensuite aux vôtres."
/** Le bouton qui ouvre la fenêtre, dans les paramètres et dans une simulation vide. */
const LIBELLE_DU_BOUTON = "Partir d'une situation type..."

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
  /** La fenêtre s'ouvre sur le détail de cette situation (« Détails » d'une carte du bloc de la page). */
  detailInitial?: MontageType
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
          <ChevronLeft /> Toutes les situations
        </Button>
        <DialogTitle>{montage.titre}</DialogTitle>
        <DialogDescription>{montage.resume}</DialogDescription>
      </DialogHeader>
      <Etiquettes etiquettes={montage.etiquettes} />
      <div className="space-y-4">
        <Rubrique titre="Questions auxquelles il répond" elements={montage.questions.map(question => question.texte)} />
        <Rubrique titre="Ce que cette situation illustre" elements={montage.illustre} />
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
        <Button onClick={onCharger}>Charger cette situation</Button>
      </DialogFooter>
    </>
  )
}

/** La fenêtre « Par où commencer ? », et la confirmation avant de remplacer une simulation non enregistrée. */
export function FenetreDesMontages({ open, onOpenChange, onCharger, confirmationNecessaire, nomDeLaSession, boutonDOuverture, declencheur: declencheurDeLaFenetre, detailInitial }: FenetreDesMontagesProps) {
  const [detail, setDetail] = useState<MontageType | null>(detailInitial ?? null)
  // Onglet, recherche, filtres et question suivie : gardés tant que la fenêtre est ouverte, oubliés à sa fermeture.
  const [bibliotheque, setBibliotheque] = useState<EtatDeLaBibliotheque>(() => etatInitialDeLaBibliotheque("situations"))
  // Après « Partir de zéro », le focus va à l'ajout d'une personne, et non au bouton qui a ouvert la fenêtre.
  const versLaSaisie = useRef(false)

  const changerOuverture = (ouverte: boolean) => {
    if (!ouverte) {
      setDetail(null)
      setBibliotheque(etatInitialDeLaBibliotheque("situations"))
    }
    onOpenChange(ouverte)
  }
  const chargement = useChargementConfirme(confirmationNecessaire, onCharger, () => changerOuverture(false))
  const voirLeDetail = (montage: MontageType) => {
    setDetail(montage)
    setBibliotheque(etat => ({ ...etat, montageVu: montage.id }))
  }

  return (
    <>
      <Dialog open={open} onOpenChange={changerOuverture}>
        {boutonDOuverture ? <DialogTrigger asChild>{boutonDOuverture}</DialogTrigger> : null}
        <DialogContent
          className="max-h-[calc(90vh/var(--zoom,1))] overflow-y-auto sm:max-w-3xl"
          // À la souris, le focus va au champ de recherche, après les onglets : on tape tout de suite. Au doigt, il reste
          // sur la fenêtre, pour ne pas ouvrir le clavier, qui cacherait la moitié de la liste.
          onOpenAutoFocus={event => {
            if (detail) return
            event.preventDefault()
            if (!(event.currentTarget instanceof HTMLElement)) return
            const recherche = event.currentTarget.querySelector<HTMLElement>("input[type=search]")
            if (window.matchMedia?.("(pointer: coarse)").matches || !recherche) event.currentTarget.focus()
            else recherche.focus()
          }}
          onCloseAutoFocus={event => {
            if (versLaSaisie.current) {
              versLaSaisie.current = false
              event.preventDefault()
              document.getElementById(ID_DE_L_AJOUT_D_UNE_PERSONNE)?.focus()
              return
            }
            if (!declencheurDeLaFenetre?.current) return
            event.preventDefault()
            declencheurDeLaFenetre.current.focus()
          }}
        >
          {detail ? (
            <DetailDuMontage montage={detail} onRetour={() => setDetail(null)} onCharger={() => chargement.demander(detail)} />
          ) : (
            <>
              <DialogHeader className="flex-row flex-wrap items-start gap-x-3 gap-y-2 pr-8 text-left">
                <div className="min-w-0 flex-[1_1_20rem] space-y-1.5">
                  <DialogTitle>{TITRE_DU_DEPART}</DialogTitle>
                  <DialogDescription>{DESCRIPTION_DU_DEPART}</DialogDescription>
                </div>
                <BoutonPartirDeZero
                  confirmationNecessaire={confirmationNecessaire}
                  nomDeLaSession={nomDeLaSession}
                  onFait={() => {
                    versLaSaisie.current = true
                    changerOuverture(false)
                  }}
                />
              </DialogHeader>
              <BibliothequeDuDepart etat={bibliotheque} onEtat={setBibliotheque} onCharger={chargement.demander} onDetails={voirLeDetail} />
            </>
          )}
        </DialogContent>
      </Dialog>

      <ConfirmationDuMontage montage={chargement.aConfirmer?.montage ?? null} nomDeLaSession={nomDeLaSession} onAnnuler={chargement.annuler} onConfirmer={montage => chargement.charger(montage, chargement.aConfirmer?.reponse)} declencheur={chargement.declencheur} />
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

/** La confirmation avant qu'un montage ne remplace une simulation non enregistrée (fenêtre, bloc de la page, adresse). */
export function ConfirmationDuMontage({ montage, nomDeLaSession, onAnnuler, onConfirmer, declencheur }: ConfirmationDuMontageProps) {
  return (
    <ConfirmationDeRemplacement open={montage !== null} onAnnuler={onAnnuler} onConfirmer={() => montage && onConfirmer(montage)} titre="Remplacer la simulation en cours ?" libelleDeConfirmation="Remplacer" declencheur={declencheur}>
      « {nomDeLaSession} » n'est pas enregistrée dans une sauvegarde. La situation « {montage?.titre} » la remplacera ; le bouton « Annuler » de la barre d'outils la rétablira.
    </ConfirmationDeRemplacement>
  )
}

/** Le bouton « Partir d'une situation type », qui ouvre la fenêtre « Par où commencer ? ». */
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
          <LayoutTemplate /> {children ?? LIBELLE_DU_BOUTON}
        </Button>
      }
    />
  )
}
