// src/ui/components/MonthlyFlowsModal.tsx

import { Fragment, useEffect, useMemo, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog"
import type { Entity, FinancialFlow } from "@/types"
import { flowTypeLabels, getFlowTypesForEntity, type FlowType } from "@/lib/flow-constants"
import { natureDejaSaisie, typeProposeDOffice } from "@/lib/nature-de-l-activite"
import { rappelDeLaLimite, remunerationSaisie } from "@/lib/limite-de-remuneration"
import { deMois } from "@/lib/grille-mensuelle"
import { DndContext, closestCenter, type DragEndEvent } from "@dnd-kit/core"
import { SortableContext, arrayMove, verticalListSortingStrategy } from "@dnd-kit/sortable"
import { FlowItem, type FlowChanges } from "./FlowItem"
import { NewFlowItem, type NewFlowValues } from "./NewFlowItem"
import { NatureDuChiffreDAffaires } from "./NatureDuChiffreDAffaires"
import { VersementsRecus } from "./VersementsRecus"
import type { VersementRecu } from "@/lib/grille-mensuelle"
import { AideALaSaisie } from "./AideALaSaisie"
import { useExtensionDeLaModification } from "../hooks/useExtensionDeLaModification"
import { useTriAccessible } from "../hooks/useTriAccessible"
import { useListeAnimee } from "../hooks/useListeAnimee"
import { anneesDuRaccourci, LIBELLES_PORTEE, LIBELLES_RACCOURCIS_ANNEES, listerAnnees, SEUIL_RACCOURCIS_ANNEES, type ChangementsDeFlux, type PorteeRecurrence, type RaccourciAnnees, type SerieAilleurs } from "@/lib/flux-recurrents"
import { reglesDeLAnneeAffichee } from "@/lib/regles-affichees"
import type { ReglesFiscales } from "@/backend/logic/regles"
import { cn } from "@/lib/utils"

/**
 * Interface pour les props du composant MonthlyFlowsModal.
 * Cette fenêtre liste les flux d'une entité pour un mois : chaque ligne s'édite sur place
 * et une dernière ligne vide permet d'en ajouter. Elle est montée à l'ouverture et démontée
 * à la fermeture, son état local repart donc de zéro à chaque ouverture.
 */
interface MonthlyFlowsModalProps {
  onClose: () => void
  flows: FinancialFlow[]
  entity: Entity
  monthName: string
  /**
   * Année affichée, pour les raccourcis « Années précédentes » et « Années suivantes », et dont les cotisations
   * salariales donnent le brut ou le net d'un salaire saisi sans pourcentage.
   */
  annee: number
  /** Autres années de la session, proposées en cases à cocher ; aucune case sans autre année. */
  autresAnnees?: number[]
  /**
   * Flux de l'acteur dans toute l'année affichée : une micro-entreprise reçoit d'office, sur la ligne d'ajout, la
   * nature de chiffre d'affaires qu'elle a déjà (voir typeProposeDOffice).
   */
  fluxDeLAnnee?: FinancialFlow[]
  /**
   * Flux de l'acteur dans les autres années de la session, de la plus proche à la plus lointaine : dans une année
   * encore vide, la micro-entreprise reçoit d'office la nature qu'elle a dans une autre année.
   */
  fluxDesAutresAnnees?: FinancialFlow[]
  /**
   * Société à l'IS : la plus haute rémunération nette que le dirigeant peut recevoir cette année sans déficit, d'après
   * les résultats de l'année. Elle est rappelée dès qu'une rémunération est saisie ou choisie sur la ligne d'ajout.
   */
  limiteDeRemuneration?: number
  /** Personne : ce que des sociétés lui versent ce mois-là (rémunération, dividendes), à lire seulement ; et leurs couleurs choisies. */
  recus?: VersementRecu[]
  couleurs?: Record<string, string>
  /**
   * Crée le flux dans ce mois et, selon la portée choisie, le recopie sur d'autres mois et dans les années cochées ;
   * `annuel` : son montant est annuel, à répartir sur les douze mois (de chaque année cochée aussi), quelle que soit la portée.
   */
  onCreate: (values: NewFlowValues, portee: PorteeRecurrence, aussiEn: number[], annuel: boolean) => void
  /** Recopie un flux sur les mois suivants de l'année affichée ; absent en décembre, où il n'y a pas de mois suivant. */
  onRecopier?: (flowId: string) => void
  /** Modifie le flux dans ce mois seulement ; la fenêtre propose ensuite de l'étendre (onEtendre). */
  onUpdate: (flowId: string, changes: FlowChanges) => void
  /** Retire le flux de ce mois seulement ; la fenêtre propose ensuite de l'étendre (onEtendre) ou de l'annuler (onRestaurer). */
  onDelete: (flowId: string) => void
  /** Où un flux (avant modification) existe hors de ce mois : dans les autres mois et les autres années. */
  serieAilleurs?: (avant: FinancialFlow) => SerieAilleurs
  /** Fait de même dans les autres mois (portée) et années : la modification `changements`, ou le retrait (`null`). */
  onEtendre?: (avant: FinancialFlow, changements: ChangementsDeFlux | null, portee: PorteeRecurrence, aussiEn: number[]) => void
  /** Remet un flux retiré dans ce mois, à son rang. */
  onRestaurer?: (flux: FinancialFlow, rang: number) => void
  onReorder: (reorderedFlows: FinancialFlow[]) => void
}

/** Texte d'avertissement quand un ajout sera recopié au-delà du mois ouvert ; `null` sinon. */
function avertissement(portee: PorteeRecurrence, aussiEn: number[]): string | null {
  const debut = "Les ajouts sont recopiés"
  if (aussiEn.length === 0) return portee === "mois" ? null : `${debut} sur les autres mois choisis.`
  const annees = listerAnnees(aussiEn)
  return portee === "mois" ? `${debut} au même mois en ${annees}.` : `${debut} sur les autres mois choisis, et aux mêmes mois en ${annees}.`
}

/** Ce que devient le montant de la ligne d'ajout quand il est annuel. */
function texteDuMontantAnnuel(annee: number, aussiEn: number[]): string {
  const annees = aussiEn.length > 0 ? `de ${listerAnnees([annee, ...aussiEn])}` : `de ${annee}`
  return `Le montant saisi sur la ligne d'ajout est annuel : il est réparti sur les 12 mois ${annees}, au centime près (l'arrondi va en décembre).`
}

/** Case qui fait du montant de la ligne d'ajout un montant annuel, réparti sur les douze mois. */
function CaseMontantAnnuel({ coche, onChange }: { coche: boolean; onChange: (coche: boolean) => void }) {
  return (
    <label className="flex min-h-9 cursor-pointer items-center gap-2 pointer-coarse:min-h-11">
      <input type="checkbox" className="size-4 cursor-pointer" checked={coche} onChange={e => onChange(e.target.checked)} />
      <span>Montant annuel, réparti sur les 12 mois</span>
    </label>
  )
}

interface NatureSiMicroEntrepriseProps {
  entity: Entity
  regles: ReglesFiscales
  type: FlowType
  flows: FinancialFlow[]
  /** Les flux de l'activité dans le reste de l'année : une nature déjà saisie replie l'aide. */
  fluxDeLAnnee: FinancialFlow[]
}

/** L'aide sur la nature du chiffre d'affaires, pour une micro-entreprise seulement ; la note sur les achats dès qu'une vente est en jeu. */
function NatureSiMicroEntreprise({ entity, regles, type, flows, fluxDeLAnnee }: NatureSiMicroEntrepriseProps) {
  // Lue à l'ouverture de la fenêtre seulement : le premier chiffre d'affaires saisi ne replie pas l'aide sous les yeux.
  const [dejaSaisie] = useState(() => natureDejaSaisie(entity, [...flows, ...fluxDeLAnnee]))
  if (entity.type !== "micro-entreprise") return null
  const avecLaVente = type === "ca_micro_vente" || flows.some(f => f.type === "ca_micro_vente")
  return <NatureDuChiffreDAffaires activite={entity} regles={regles} valeur={type} avecLaVente={avecLaVente} natureDejaSaisie={dejaSaisie} />
}

/**
 * Sous la ligne d'ajout, dès qu'une rémunération du dirigeant est saisie dans l'année ou choisie pour l'ajout : ce qui
 * est saisi, et ce que la société peut verser au plus sans déficit. La limite se lit avant de la dépasser, pas dans
 * une alerte des résultats après coup. Elle suit les résultats de l'année, recalculés peu après chaque saisie.
 */
function LimiteDeLaRemuneration({ limite, fluxDeLAnnee, enAjout }: { limite: number | undefined; fluxDeLAnnee: FinancialFlow[]; enAjout: boolean }) {
  const saisie = remunerationSaisie(fluxDeLAnnee)
  if (limite === undefined || (!enAjout && saisie <= 0)) return null
  const { texte, depassee } = rappelDeLaLimite(saisie, limite)
  return (
    <p role="status" data-limite-de-remuneration={depassee ? "depassee" : "tenue"} className={cn("rounded-md px-3 py-1.5 text-sm", depassee ? "bg-amber-50 text-amber-950 dark:bg-amber-950 dark:text-amber-100" : "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300")}>
      <span className="font-medium">Rémunération du dirigeant.</span> {texte}
    </p>
  )
}

/** Mise en évidence d'un réglage qui étend les opérations au-delà du mois ouvert. */
const EN_EVIDENCE = "border-amber-500 bg-amber-50 ring-2 ring-amber-300 dark:bg-amber-950 dark:ring-amber-700"

/** Ordre d'affichage des raccourcis. */
const RACCOURCIS: RaccourciAnnees[] = ["toutes", "aucune", "precedentes", "suivantes"]

interface CasesDesAnneesProps {
  annee: number
  autresAnnees: number[]
  aussiEn: number[]
  setAussiEn: (annees: number[]) => void
}

/**
 * Les autres années de la session, en cases à cocher, mises en évidence dès qu'une est cochée. Au-delà de
 * SEUIL_RACCOURCIS_ANNEES, des raccourcis cochent toutes les années, aucune, les précédentes ou les suivantes ;
 * la liste passe alors sur sa propre ligne et va à la ligne autant que nécessaire.
 */
function CasesDesAnnees({ annee, autresAnnees, aussiEn, setAussiEn }: CasesDesAnneesProps) {
  const avecRaccourcis = autresAnnees.length > SEUIL_RACCOURCIS_ANNEES
  const basculerAnnee = (a: number, cochee: boolean) => setAussiEn(cochee ? [...aussiEn, a] : aussiEn.filter(x => x !== a))

  return (
    <fieldset className={cn("rounded-md border border-transparent px-2", avecRaccourcis && "w-full", aussiEn.length > 0 && EN_EVIDENCE)}>
      {/* Sur un écran étroit, avec les raccourcis, la légende prend toute la ligne : les raccourcis vont dessous. */}
      <legend className={cn("float-left mr-2 flex min-h-9 items-center pointer-coarse:min-h-11", avecRaccourcis && "@max-[34rem]:w-full")}>Aussi en :</legend>
      {avecRaccourcis ? (
        <div className="flex flex-wrap items-center gap-1 py-0.5 @max-[34rem]:clear-left">
          {RACCOURCIS.map(raccourci => {
            const annees = anneesDuRaccourci(raccourci, annee, autresAnnees)
            // Pas d'année avant (ou après) l'année affichée : le raccourci est désactivé. Il ne l'est jamais à la suite
            // d'un clic (sélection déjà identique), pour que le focus ne se perde pas.
            return (
              <Button
                key={raccourci}
                type="button"
                size="sm"
                variant="outline"
                className="text-sm"
                aria-label={LIBELLES_RACCOURCIS_ANNEES[raccourci].nom}
                disabled={raccourci !== "aucune" && annees.length === 0}
                onClick={() => setAussiEn(annees)}
              >
                {LIBELLES_RACCOURCIS_ANNEES[raccourci].texte}
              </Button>
            )
          })}
        </div>
      ) : null}
      <div className={cn("flex flex-wrap items-center gap-x-4", avecRaccourcis && "clear-left")}>
        {autresAnnees.map(a => (
          <label key={a} className="flex min-h-9 cursor-pointer items-center gap-2 pointer-coarse:min-h-11">
            <input type="checkbox" className="size-4 cursor-pointer accent-amber-600" checked={aussiEn.includes(a)} onChange={e => basculerAnnee(a, e.target.checked)} />
            {a}
          </label>
        ))}
      </div>
    </fieldset>
  )
}

interface ReglagesDeLAjoutProps extends CasesDesAnneesProps {
  portee: PorteeRecurrence
  setPortee: (portee: PorteeRecurrence) => void
  annuel: boolean
  setAnnuel: (annuel: boolean) => void
  /** Un salaire se saisit par mois, comme son bulletin : ses cotisations dépendent du plafond mensuel. Pas de montant annuel. */
  pourUnSalaire: boolean
}

/** Sous la ligne d'ajout, où l'ajout vaut : les mois (« Ajouter à »), le montant annuel, les autres années. */
function ReglagesDeLAjout({ annee, autresAnnees, portee, setPortee, aussiEn, setAussiEn, annuel, setAnnuel, pourUnSalaire }: ReglagesDeLAjoutProps) {
  const repartir = annuel && !pourUnSalaire
  const texteAvertissement = repartir ? null : avertissement(portee, aussiEn)
  return (
    <>
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 px-1 text-sm text-slate-700 dark:text-slate-300">
        {/* `min-w-0 max-w-full` : avec une police large, la liste se resserre à la largeur de la fenêtre au lieu de la déborder. */}
        <label className="flex min-w-0 max-w-full flex-wrap items-center gap-2">
          Ajouter à :
          {/* Hors « ce mois seulement », la liste est mise en évidence : l'ajout sera recopié sur d'autres mois. Sans
              objet pour un montant annuel, toujours réparti sur les douze mois. */}
          <select disabled={repartir} className={cn("h-9 max-w-full rounded-md border border-input bg-background px-2 text-sm disabled:opacity-60 pointer-coarse:h-11", portee !== "mois" && !repartir && cn(EN_EVIDENCE, "font-medium"))} value={portee} onChange={e => setPortee(e.target.value as PorteeRecurrence)}>
            {(Object.keys(LIBELLES_PORTEE) as PorteeRecurrence[]).map(cle => (
              <option key={cle} value={cle}>
                {LIBELLES_PORTEE[cle]}
              </option>
            ))}
          </select>
        </label>
        {pourUnSalaire ? null : <CaseMontantAnnuel coche={annuel} onChange={setAnnuel} />}
        {/* Les autres années de la session, seulement s'il y en a ; mises en évidence dès qu'une est cochée. */}
        {autresAnnees.length > 0 ? <CasesDesAnnees annee={annee} autresAnnees={autresAnnees} aussiEn={aussiEn} setAussiEn={setAussiEn} /> : null}
      </div>
      {repartir ? <p className="px-1 text-sm text-slate-700 dark:text-slate-300">{texteDuMontantAnnuel(annee, aussiEn)}</p> : null}
      {texteAvertissement ? <p className="px-1 text-sm text-amber-900 dark:text-amber-100">{texteAvertissement}</p> : null}
    </>
  )
}

export function MonthlyFlowsModal({ onClose, flows, entity, monthName, annee, autresAnnees = [], fluxDeLAnnee = [], fluxDesAutresAnnees = [], limiteDeRemuneration, recus, couleurs, onCreate, onRecopier, onUpdate, onDelete, serieAilleurs, onEtendre, onRestaurer, onReorder }: MonthlyFlowsModalProps) {
  const flowIds = useMemo(() => flows.map(f => f.id), [flows])
  const tri = useTriAccessible(useMemo(() => flows.map(f => ({ id: f.id, nom: f.label || flowTypeLabels[f.type] })), [flows]))
  const allowedTypes = getFlowTypesForEntity(entity)
  const regles = reglesDeLAnneeAffichee(annee)

  // Type prérempli de la ligne d'ajout : le dernier type utilisé dans cette fenêtre, sinon celui proposé d'office
  // (pour une micro-entreprise, la nature de chiffre d'affaires qu'elle a déjà dans l'année).
  const [newFlowType, setNewFlowType] = useState<FlowType>(() => typeProposeDOffice(entity, [...flows, ...fluxDeLAnnee, ...fluxDesAutresAnnees]))
  // Portée des ajouts, choisie avant d'ajouter : gardée tant que la fenêtre est ouverte.
  const [portee, setPortee] = useState<PorteeRecurrence>("mois")
  // Autres années où recopier aussi les ajouts : aucune cochée à chaque ouverture.
  const [aussiEn, setAussiEn] = useState<number[]>([])
  // Modifications et retraits : pour ce mois, puis une barre propose de faire de même dans les autres mois.
  const { modifier, retirer, oublier, barreApres, barreAuRang } = useExtensionDeLaModification({ flows, mois: monthName, onUpdate, onDelete, serieAilleurs, onEtendre, onRestaurer })
  // Montant de la ligne d'ajout saisi pour l'année, réparti sur les douze mois ; jamais pour un salaire.
  const [annuel, setAnnuel] = useState(false)
  const repartirSurLAnnee = annuel && newFlowType !== "salary"

  const listRef = useRef<HTMLDivElement>(null)
  const newFlowLabelRef = useRef<HTMLInputElement>(null)

  // Quand un flux est ajouté, la liste défile pour le montrer.
  const previousFlowCount = useRef(flows.length)
  useEffect(() => {
    if (flows.length > previousFlowCount.current) {
      listRef.current?.scrollTo({ top: listRef.current.scrollHeight })
    }
    previousFlowCount.current = flows.length
  }, [flows.length])


  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (over && active.id !== over.id) {
      const oldIndex = flowIds.indexOf(active.id as string)
      const newIndex = flowIds.indexOf(over.id as string)
      onReorder(arrayMove(flows, oldIndex, newIndex))
    }
  }
  // Un flux ajouté ou retiré : les autres lignes glissent à leur place.
  const [refDeLaListe, glisser] = useListeAnimee(handleDragEnd, listRef)

  const handleClose = () => {
    // Retirer le focus valide la saisie en cours avant que la fenêtre ne soit démontée.
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur()
    onClose()
  }

  return (
    <Dialog open onOpenChange={open => !open && handleClose()}>
      <DialogContent
        // Sur un téléphone, la fenêtre peut dépasser la hauteur de l'écran : elle défile plutôt que d'être coupée.
        // `min-w-0` : son contenu (la longue liste « Ajouter à ») se resserre au lieu de la faire défiler en largeur.
        className="max-h-[calc(100dvh/var(--zoom,1)_-_2rem)] overflow-y-auto sm:max-w-4xl [&>*]:min-w-0"
        // À l'ouverture, le focus va sur la ligne d'ajout pour saisir sans clic supplémentaire.
        onOpenAutoFocus={event => {
          event.preventDefault()
          newFlowLabelRef.current?.focus()
        }}
        // Échap annule d'abord la saisie en cours du champ ; la fenêtre ne se ferme que s'il n'y en a pas.
        onEscapeKeyDown={event => {
          if (event.target instanceof HTMLElement && event.target.dataset.editing === "true") event.preventDefault()
        }}
      >
        <DialogHeader>
          <DialogTitle className="flex items-baseline gap-2">
            <span>Opérations {deMois(monthName)}</span>
            <span className="text-base font-normal text-slate-600 dark:text-slate-400">/ {entity.name}</span>
          </DialogTitle>
          {/* Une phrase pour commencer ; le reste du mode d'emploi, replié, ne repousse pas les champs sous l'écran. */}
          <DialogDescription>Modifiez les flux dans la liste ; la dernière ligne en ajoute un (Entrée sur le montant valide et enchaîne).</DialogDescription>
          <AideALaSaisie autresAnnees={autresAnnees.length > 0} recopie={!!onRecopier} anneeDesCotisations={entity.type === "person" ? regles.annee : undefined} />
        </DialogHeader>

        {/* Conteneur : les lignes de flux suivent la largeur de la fenêtre de saisie (une ligne par flux dès 34 rem, sinon
            deux), pas celle de l'écran : interface agrandie, la fenêtre est bien plus étroite que l'écran ne le laisse croire. */}
        <div className="@container space-y-2 py-2">
          <VersementsRecus recus={recus ?? []} couleurs={couleurs} />
          {flows.length > 0 && (
            <DndContext {...tri} collisionDetection={closestCenter} {...glisser}>
              <div ref={refDeLaListe} className="max-h-[calc(50vh/var(--zoom,1))] space-y-2 overflow-y-auto">
                <SortableContext items={flowIds} strategy={verticalListSortingStrategy}>
                  {flows.map((flow, rang) => (
                    <Fragment key={flow.id}>
                      {barreAuRang(rang)}
                      <FlowItem flow={flow} allowedTypes={allowedTypes} onUpdate={modifier} onDelete={retirer} onRecopier={onRecopier} onTypeUsed={setNewFlowType} typeActeur={entity.type} regles={regles} />
                      {barreApres(flow.id)}
                    </Fragment>
                  ))}
                  {barreAuRang(flows.length)}
                </SortableContext>
              </div>
            </DndContext>
          )}
          {/* Le dernier flux du mois retiré : la liste a disparu, la barre reste au-dessus de la ligne d'ajout. */}
          {flows.length === 0 ? barreAuRang(0) : null}

          <NewFlowItem
            type={newFlowType}
            allowedTypes={allowedTypes}
            onTypeChange={setNewFlowType}
            onCreate={values => {
              oublier()
              onCreate(values, portee, aussiEn, repartirSurLAnnee)
            }}
            labelInputRef={newFlowLabelRef}
            typeActeur={entity.type}
            regles={regles}
            montantAnnuel={repartirSurLAnnee}
          />
          <NatureSiMicroEntreprise entity={entity} regles={regles} type={newFlowType} flows={flows} fluxDeLAnnee={fluxDeLAnnee} />
          <LimiteDeLaRemuneration limite={limiteDeRemuneration} fluxDeLAnnee={fluxDeLAnnee} enAjout={newFlowType === "director_remuneration"} />
          <ReglagesDeLAjout annee={annee} autresAnnees={autresAnnees} portee={portee} setPortee={setPortee} aussiEn={aussiEn} setAussiEn={setAussiEn} annuel={annuel} setAnnuel={setAnnuel} pourUnSalaire={newFlowType === "salary"} />
        </div>

        <DialogFooter>
          <Button variant="secondary" onClick={handleClose}>
            Terminé
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
