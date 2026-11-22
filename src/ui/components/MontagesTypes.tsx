// src/ui/components/MontagesTypes.tsx
// « Partir d'une situation type » : la bibliothèque des montages types en cartes, à retrouver par une recherche et
// des filtres (statut, foyer : voir src/lib/montages/filtres.ts), le détail de chacun (ce qu'il
// illustre, ses conditions, ses risques, ses sources), puis son chargement, confirmé quand la simulation en cours
// serait perdue. Les boutons qui ouvrent la fenêtre parlent de « situation type », ce que l'on vient y chercher ;
// dans la fenêtre, chacune reste un « montage ». Dans la démo web, chaque carte donne aussi le lien qui ouvre la
// situation (#situation=…), à copier pour le partager. En tête de la bibliothèque, les questions de l'encart
// « Que voulez-vous savoir ? » restent à portée, même une fois l'encart fermé.

import { useId, useRef, useState, type ReactNode, type RefObject } from "react"
import { Check, ChevronLeft, ExternalLink, LayoutTemplate, Link, Search } from "lucide-react"
import { Button, type ButtonProps } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import { usePlateforme } from "../plateforme"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { ConfirmationDeRemplacement } from "./ConfirmationDeRemplacement"
import { ANNEE_DES_MONTAGES } from "@/lib/montages/construction"
import { AUCUN_CRITERE, criteresActifs, FILTRES_DE_FOYER, FILTRES_DE_STATUT, filtrerLesMontages, type CriteresDesMontages } from "@/lib/montages/filtres"
import { MONTAGES_TYPES, type MontageType } from "@/lib/montages/montages"
import { QUESTIONS_DE_DEPART, type QuestionDeDepart } from "@/lib/questions-de-depart"

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

interface CarteDuMontageProps {
  montage: MontageType
  onDetails: () => void
  onCharger: () => void
  focus: boolean
  /** Copie le lien de la situation ; absent sans lien à partager (application de bureau). */
  onCopierLeLien?: () => void
  /** Le lien de cette situation vient d'être copié. */
  lienCopie: boolean
}

function CarteDuMontage({ montage, onDetails, onCharger, focus, onCopierLeLien, lienCopie }: CarteDuMontageProps) {
  return (
    <li className="flex flex-col gap-3 rounded-lg border bg-slate-50 p-4 dark:bg-gray-900">
      <h3 className="font-semibold">
        {montage.titre}
      </h3>
      <p className="text-sm text-slate-700 dark:text-slate-300">{montage.resume}</p>
      <Etiquettes etiquettes={montage.etiquettes} />
      <div className="mt-auto flex flex-wrap gap-2 pt-1">
        <Button variant="outline" size="sm" onClick={onDetails} autoFocus={focus} aria-label={`Détails de la situation « ${montage.titre} »`}>
          Détails
        </Button>
        <Button size="sm" onClick={onCharger} aria-label={`Charger la situation « ${montage.titre} »`}>
          Charger
        </Button>
        {onCopierLeLien ? (
          <Button variant="ghost" size="sm" onClick={onCopierLeLien} aria-label={`Copier le lien de la situation « ${montage.titre} »`}>
            {lienCopie ? <Check aria-hidden /> : <Link aria-hidden />}
            {lienCopie ? "Lien copié" : "Copier le lien"}
          </Button>
        ) : null}
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
          <ChevronLeft /> Toutes les situations
        </Button>
        <DialogTitle>{montage.titre}</DialogTitle>
        <DialogDescription>{montage.resume}</DialogDescription>
      </DialogHeader>
      <Etiquettes etiquettes={montage.etiquettes} />
      <div className="space-y-4">
        <Rubrique titre="Questions auxquelles il répond" elements={montage.questions} />
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

/** Résultat de la dernière copie d'un lien, lu par les lecteurs d'écran. */
type EtatDeLaCopie = { identifiant: string; message: string; erreur: boolean } | null

/** La copie du lien d'une situation ; `copier` est absent sans lien à partager (application de bureau). */
function useCopieDuLien() {
  const { lienVersUneSituation } = usePlateforme()
  const [etat, setEtat] = useState<EtatDeLaCopie>(null)
  const copierLeLien = async (montage: MontageType, lien: string) => {
    try {
      await navigator.clipboard.writeText(lien)
      setEtat({ identifiant: montage.id, message: `Lien de « ${montage.titre} » copié : ${lien}`, erreur: false })
    } catch {
      setEtat({ identifiant: montage.id, message: `La copie a échoué : sélectionnez le lien pour le copier, ${lien}`, erreur: true })
    }
  }
  const copier = lienVersUneSituation ? (montage: MontageType) => void copierLeLien(montage, lienVersUneSituation(montage.id)) : undefined
  return { etat, copier }
}

const PUCE = "inline-flex h-8 cursor-pointer items-center rounded-full border border-slate-300 px-3 text-sm font-medium text-slate-800 hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring pointer-coarse:min-h-11 dark:border-slate-600 dark:text-slate-100 dark:hover:bg-slate-800"
const PUCE_COCHEE = "border-slate-900 bg-slate-900 text-white hover:bg-slate-800 dark:border-slate-100 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-200"

/** Un axe de filtres à cocher : plusieurs choix s'ajoutent, aucun ne filtre pas. */
function PucesDeFiltre<T extends string>({ titre, choix, coches, onChange }: { titre: string; choix: { valeur: T; libelle: string }[]; coches: T[]; onChange: (coches: T[]) => void }) {
  return (
    <div role="group" aria-label={titre} className="flex flex-wrap items-center gap-1.5">
      <span className="mr-0.5 text-sm text-slate-600 dark:text-slate-400">{titre}</span>
      {choix.map(({ valeur, libelle }) => {
        const coche = coches.includes(valeur)
        return (
          <button key={valeur} type="button" aria-pressed={coche} className={cn(PUCE, coche && PUCE_COCHEE)} onClick={() => onChange(coche ? coches.filter(c => c !== valeur) : [...coches, valeur])}>
            {libelle}
          </button>
        )
      })}
    </div>
  )
}

/** La recherche et les filtres de la bibliothèque, puis le nombre de situations trouvées tant qu'un critère restreint la liste. */
function FiltresDesMontages({ criteres, onChange, trouvees }: { criteres: CriteresDesMontages; onChange: (criteres: CriteresDesMontages) => void; trouvees: number }) {
  const actifs = criteresActifs(criteres)
  return (
    <div className="space-y-2">
      <div className="relative">
        <Search aria-hidden className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-500 dark:text-slate-400" />
        <Input type="search" aria-label="Rechercher une situation" placeholder="Rechercher" title="Rechercher dans les titres, les résumés et les mots-clés : dividendes, retraite, kiné…" className="pl-9" value={criteres.recherche} onChange={evenement => onChange({ ...criteres, recherche: evenement.target.value })} />
      </div>
      <div className="flex flex-wrap gap-x-6 gap-y-2">
        <PucesDeFiltre titre="Statut" choix={FILTRES_DE_STATUT} coches={criteres.statuts} onChange={statuts => onChange({ ...criteres, statuts })} />
        <PucesDeFiltre titre="Foyer" choix={FILTRES_DE_FOYER} coches={criteres.foyers} onChange={foyers => onChange({ ...criteres, foyers })} />
      </div>
      {/* Annoncé aux lecteurs d'écran à chaque changement ; vide sans critère, pour ne rien ajouter à la fenêtre. */}
      <p aria-live="polite" className="flex min-h-6 flex-wrap items-center gap-x-3 text-sm text-slate-700 dark:text-slate-300">
        {actifs ? (
          <>
            <span>
              {trouvees === 0 ? "Aucune situation ne correspond." : `${trouvees} situation${trouvees > 1 ? "s" : ""} sur ${MONTAGES_TYPES.length}`}
            </span>
            <button type="button" className="inline-flex min-h-6 cursor-pointer items-center rounded-sm text-blue-700 underline underline-offset-2 hover:no-underline pointer-coarse:min-h-11 dark:text-blue-300" onClick={() => onChange(AUCUN_CRITERE)}>
              Tout afficher
            </button>
          </>
        ) : null}
      </p>
    </div>
  )
}

type QuestionAvecSaSituation = QuestionDeDepart & { montage: MontageType }

/** Les questions de l'encart qui mènent à une situation type (celles qui mènent à une section de la page n'ont rien à faire ici). */
const QUESTIONS_DE_LA_BIBLIOTHEQUE = QUESTIONS_DE_DEPART.filter((question): question is QuestionAvecSaSituation => "montage" in question)

/**
 * « Que voulez-vous savoir ? » : les questions de l'encart du premier lancement, en boutons courts. Un clic charge la
 * situation type de la question, comme son bouton « Charger » ; la précision de chaque question est sa description.
 */
function QuestionsDeDepart({ onCharger }: { onCharger: (montage: MontageType) => void }) {
  const titre = useId()
  const precision = useId()
  return (
    <section aria-labelledby={titre} className="space-y-1.5">
      <h3 id={titre} className="text-sm font-medium text-slate-800 dark:text-slate-100">
        Que voulez-vous savoir ?
      </h3>
      <ul className="flex flex-wrap gap-2">
        {QUESTIONS_DE_LA_BIBLIOTHEQUE.map((question, rang) => (
          <li key={question.question}>
            <Button type="button" variant="outline" size="sm" className="h-auto min-h-8 py-1 text-left text-sm whitespace-normal pointer-coarse:min-h-11" title={question.precision} aria-describedby={`${precision}-${rang}`} onClick={() => onCharger(question.montage)}>
              {question.question}
            </Button>
            <span id={`${precision}-${rang}`} className="sr-only">
              {question.precision}
            </span>
          </li>
        ))}
      </ul>
    </section>
  )
}

interface ListeDesMontagesProps {
  onDetails: (montage: MontageType) => void
  onCharger: (montage: MontageType) => void
  montageVu: string | null
  /** Recherche et filtres : gardés par la fenêtre, pour les retrouver au retour du détail d'une situation. */
  criteres: CriteresDesMontages
  onCriteres: (criteres: CriteresDesMontages) => void
}

function ListeDesMontages({ onDetails, onCharger, montageVu, criteres, onCriteres }: ListeDesMontagesProps) {
  const { etat, copier } = useCopieDuLien()
  const montages = filtrerLesMontages(MONTAGES_TYPES, criteres)
  return (
    <>
      <DialogHeader>
        <DialogTitle>{TITRE_DE_LA_FENETRE}</DialogTitle>
        <DialogDescription>Des simulations d'une année, préremplies avec des chiffres fictifs, à charger puis à adapter. Chacune explique ce qu'elle illustre, ses conditions et ses risques.</DialogDescription>
      </DialogHeader>
      <QuestionsDeDepart onCharger={onCharger} />
      <FiltresDesMontages criteres={criteres} onChange={onCriteres} trouvees={montages.length} />
      <ul aria-label="Situations types" className="grid gap-3 sm:grid-cols-2">
        {montages.map(montage => (
          <CarteDuMontage
            key={montage.id}
            montage={montage}
            onDetails={() => onDetails(montage)}
            onCharger={() => onCharger(montage)}
            focus={montage.id === montageVu}
            onCopierLeLien={copier && (() => copier(montage))}
            lienCopie={etat?.identifiant === montage.id && !etat.erreur}
          />
        ))}
      </ul>
      {copier ? (
        <p role="status" className={cn("min-h-5 text-sm break-all", etat?.erreur ? "text-red-700 dark:text-red-400" : "text-emerald-800 dark:text-emerald-300")}>
          {etat?.message}
        </p>
      ) : null}
    </>
  )
}

/** La fenêtre des montages types, et la confirmation avant de remplacer une simulation non enregistrée. */
export function FenetreDesMontages({ open, onOpenChange, onCharger, confirmationNecessaire, nomDeLaSession, boutonDOuverture, declencheur: declencheurDeLaFenetre }: FenetreDesMontagesProps) {
  const [detail, setDetail] = useState<MontageType | null>(null)
  // Dernier montage dont on a vu le détail : de retour à la liste, le focus revient sur sa carte.
  const [montageVu, setMontageVu] = useState<string | null>(null)
  const [aConfirmer, setAConfirmer] = useState<MontageType | null>(null)
  // Recherche et filtres : gardés tant que la fenêtre est ouverte, oubliés à sa fermeture.
  const [criteres, setCriteres] = useState<CriteresDesMontages>(AUCUN_CRITERE)
  // Bouton qui a demandé la confirmation : « Annuler » y ramène le focus.
  const declencheur = useRef<HTMLElement | null>(null)

  const changerOuverture = (ouverte: boolean) => {
    if (!ouverte) {
      setDetail(null)
      setMontageVu(null)
      setCriteres(AUCUN_CRITERE)
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
          className="max-h-[calc(90vh/var(--zoom,1))] overflow-y-auto sm:max-w-3xl"
          // À la souris, le focus va au champ de recherche, après les questions : on tape tout de suite. Au doigt, il reste
          // sur la fenêtre, pour ne pas ouvrir le clavier, qui cacherait la moitié des situations.
          onOpenAutoFocus={event => {
            event.preventDefault()
            if (!(event.currentTarget instanceof HTMLElement)) return
            const recherche = event.currentTarget.querySelector<HTMLElement>("input[type=search]")
            if (window.matchMedia?.("(pointer: coarse)").matches || !recherche) event.currentTarget.focus()
            else recherche.focus()
          }}
          onCloseAutoFocus={event => {
            if (!declencheurDeLaFenetre?.current) return
            event.preventDefault()
            declencheurDeLaFenetre.current.focus()
          }}
        >
          {detail ? <DetailDuMontage montage={detail} onRetour={() => setDetail(null)} onCharger={() => demanderLeChargement(detail)} /> : <ListeDesMontages onDetails={voirLeDetail} onCharger={demanderLeChargement} montageVu={montageVu} criteres={criteres} onCriteres={setCriteres} />}
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
      « {nomDeLaSession} » n'est pas enregistrée dans une sauvegarde. La situation « {montage?.titre} » la remplacera ; le bouton « Annuler » de la barre d'outils la rétablira.
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
