// src/ui/components/MonthlyGrid.tsx

import React, { useState, useMemo, useRef, Dispatch, SetStateAction } from "react"
import type { AnneeSimulee, Entity, MonthlyGridData, FinancialFlow, UserPreferences } from "@/types"
import { MonthlyFlowsModal } from "./MonthlyFlowsModal"
import type { FlowChanges } from "./FlowItem"
import type { NewFlowValues } from "./NewFlowItem"
import { CellChartDisplay, FlowSegment } from "./CellChartDisplay"
import { DEFAULT_FLOW_COLORS } from "@/lib/color-constants"
import { isExpenseFlowType } from "@/lib/flow-constants"
import { createId } from "@/lib/id"
import { ajouterDansLesAnnees, modifierDansLesAnnees, modifierSerie, recopierFlux, resumerMoisTouches, supprimerDansLesAnnees, supprimerSerie, type CibleDansLesAnnees, type MoisTouches, type PorteeRecurrence } from "@/lib/flux-recurrents"
import { toast } from "sonner"
import { AvatarDisplay } from "./AvatarDisplay"
import { cn } from "@/lib/utils"
import { useAffichageResume } from "../hooks/useAffichage"
import { useDefilementDeLaGrille } from "../hooks/useDefilementDeLaGrille"
import { useHautDesBarres } from "../hooks/useHautDesBarres"
import { BandeDesMois, FondusDesBords } from "./BandeDesMois"
import { defilementPourLaPosition, defilementPourLeMois, defilementVoisin } from "@/lib/bande-des-mois"

/**
 * Interface pour les props du composant MonthlyGrid.
 * Ce composant est le cœur de la visualisation des données, affichant une grille
 * interactive des flux financiers pour chaque entité, mois par mois, ainsi qu'un total annuel.
 */
interface MonthlyGridProps {
  entities: Entity[]
  monthlyData: MonthlyGridData
  setMonthlyData: Dispatch<SetStateAction<MonthlyGridData>>
  preferences: UserPreferences
  flowTypeToNumberMap: Map<string, number>
  /** Année de la grille, rappelée dans le titre à l'impression. */
  annee?: number
  /** Sélecteur d'année, affiché à côté du titre. */
  selecteurAnnee?: React.ReactNode
  /** Toutes les années de la session, pour appliquer aussi une opération aux autres années cochées. */
  annees?: AnneeSimulee[]
  /** Remplace les années de la session en une seule modification (une seule étape d'annulation). */
  setAnnees?: (annees: AnneeSimulee[]) => void
}

// Constantes pour les labels des mois
const months = ["Janv", "Févr", "Mars", "Avril", "Mai", "Juin", "Juil", "Août", "Sept", "Oct", "Nov", "Déc"]
const fullMonths = ["Janvier", "Février", "Mars", "Avril", "Mai", "Juin", "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"]

/** « de mars », mais « d’avril », « d’août », « d’octobre » : l’élision devant une voyelle. */
const deMois = (mois: string) => (/^[aeiouâéèêîôû]/i.test(mois) ? `d’${mois.toLowerCase()}` : `de ${mois.toLowerCase()}`)

function MonthlyGrid({ entities, monthlyData, setMonthlyData, preferences, flowTypeToNumberMap, annee, selecteurAnnee, annees, setAnnees }: MonthlyGridProps) {
  // Affichage « Résumé » : lignes plus basses, avatar en petit à côté du nom.
  const resume = useAffichageResume()
  // Bande des mois et fondus des bords : seulement quand la grille déborde de sa zone et doit défiler.
  const zone = useRef<HTMLDivElement>(null)
  const defilement = useDefilementDeLaGrille(zone, entities.length > 0, annee)
  const haut = useHautDesBarres(defilement.deborde)
  const fluxDesMois = useMemo(() => {
    const acteurs = new Set(entities.map(e => e.id))
    return monthlyData.map(mois => mois.flows.filter(f => acteurs.has(f.entityId)).length)
  }, [monthlyData, entities])
  // ===================================================================================
  // == ÉTAT DE LA FENÊTRE DES FLUX
  // ===================================================================================
  // Case (entité + mois) dont la fenêtre des flux est ouverte ; `null` quand elle est fermée.
  const [openCell, setOpenCell] = useState<{ entityId: string; monthIndex: number } | null>(null)
  const openCellEntity = openCell ? entities.find(e => e.id === openCell.entityId) : undefined
  // Autres années de la session, proposées dans la fenêtre des flux ; aucune si la grille ne les connaît pas.
  const autresAnnees = annees && setAnnees && annee !== undefined ? annees.map(a => a.annee).filter(a => a !== annee) : []

  // ===================================================================================
  // == HANDLERS POUR LES ACTIONS UTILISATEUR
  // ===================================================================================
  /**
   * Applique une transformation aux flux du mois ouvert.
   * Si la transformation renvoie la liste inchangée, les données gardent la même référence :
   * aucune entrée n'est alors ajoutée à l'historique undo/redo.
   */
  const updateOpenMonthFlows = (update: (flows: FinancialFlow[]) => FinancialFlow[]) => {
    if (!openCell) return
    const { monthIndex } = openCell
    setMonthlyData(prevData => {
      const flows = update(prevData[monthIndex].flows)
      if (flows === prevData[monthIndex].flows) return prevData
      return prevData.map((monthData, index) => (index === monthIndex ? { ...monthData, flows } : monthData))
    })
  }
  /**
   * Applique une opération à l'année affichée et aux autres années cochées, en une seule modification de la
   * session : une seule étape d'annulation. Renvoie `false` si aucune autre année n'est cochée : l'opération
   * suit alors le chemin habituel, limité à l'année affichée.
   */
  const dansLesAnnees = (aussiEn: number[], portee: PorteeRecurrence, operation: (annees: AnneeSimulee[], cible: CibleDansLesAnnees) => { annees: AnneeSimulee[]; touches: MoisTouches[] }, annonce: string) => {
    if (aussiEn.length === 0 || !openCell || !annees || !setAnnees || annee === undefined) return false
    const { annees: nouvelles, touches } = operation(annees, { annee, depuis: openCell.monthIndex, portee, autresAnnees: aussiEn })
    setAnnees(nouvelles)
    if (touches.length > 0) toast.success(`${annonce} ${resumerMoisTouches(touches)}.`)
    return true
  }
  const handleCreateFlow = (values: NewFlowValues, portee: PorteeRecurrence = "mois", aussiEn: number[] = []) => {
    if (!openCell) return
    // L'identifiant est généré hors de la fonction de mise à jour, qui doit rester pure.
    const newFlow: FinancialFlow = { id: createId("flow"), entityId: openCell.entityId, ...values }
    if (dansLesAnnees(aussiEn, portee, (a, cible) => ajouterDansLesAnnees(a, newFlow, cible, () => createId("flow")), "Flux ajouté à ce mois et recopié sur")) return
    if (portee === "mois") {
      updateOpenMonthFlows(flows => [...flows, newFlow])
      return
    }
    // Ajout et recopies en une seule modification : une seule étape d'annulation.
    const { monthIndex } = openCell
    const avecLeNouveau = monthlyData.map((mois, index) => (index === monthIndex ? { ...mois, flows: [...mois.flows, newFlow] } : mois))
    const { grille, ajouts } = recopierFlux(avecLeNouveau, newFlow, monthIndex, portee, () => createId("flow"))
    setMonthlyData(grille)
    if (ajouts > 0) toast.success(`Flux ajouté à ce mois et recopié sur ${ajouts} autre${ajouts > 1 ? "s" : ""} mois.`)
  }
  /** Recopie un flux du mois ouvert sur les mois suivants, jusqu'en décembre, sans doublon. */
  const handleRecopierFlux = (flowId: string) => {
    if (!openCell) return
    const { monthIndex } = openCell
    const flux = monthlyData[monthIndex].flows.find(f => f.id === flowId)
    if (!flux) return
    const { grille, ajouts } = recopierFlux(monthlyData, flux, monthIndex, "suivants", () => createId("flow"))
    if (ajouts === 0) {
      toast.info("Ce flux est déjà présent sur tous les mois suivants.")
      return
    }
    setMonthlyData(grille)
    toast.success(`Flux recopié sur ${ajouts} mois, jusqu'en décembre.`)
  }
  /** Flux du mois ouvert, pour reporter une modification ou une suppression sur sa série dans les autres mois. */
  const fluxOuvert = (flowId: string) => (openCell ? monthlyData[openCell.monthIndex].flows.find(f => f.id === flowId) : undefined)
  /** Notification du nombre d'autres mois touchés par une modification ou une suppression de série. */
  const annoncerSerie = (action: string, touches: number) => {
    if (touches > 0) toast.success(`${action} aussi sur ${touches} autre${touches > 1 ? "s" : ""} mois.`)
  }
  const handleUpdateFlow = (flowId: string, changes: FlowChanges, portee: PorteeRecurrence = "mois", aussiEn: number[] = []) => {
    const flux = fluxOuvert(flowId)
    if (flux && dansLesAnnees(aussiEn, portee, (a, cible) => modifierDansLesAnnees(a, flux, cible, changes), "Modifié aussi sur")) return
    if (portee !== "mois" && flux && openCell) {
      const { grille, touches } = modifierSerie(monthlyData, flux, openCell.monthIndex, portee, changes)
      setMonthlyData(grille)
      annoncerSerie("Modifié", touches)
      return
    }
    updateOpenMonthFlows(flows => {
      const current = flows.find(f => f.id === flowId)
      if (!current) return flows
      const updated = { ...current, ...changes }
      if (updated.type === current.type && updated.label === current.label && updated.amount === current.amount && updated.grossAmount === current.grossAmount) return flows
      return flows.map(f => (f.id === flowId ? updated : f))
    })
  }
  const handleDeleteFlow = (flowId: string, portee: PorteeRecurrence = "mois", aussiEn: number[] = []) => {
    const flux = fluxOuvert(flowId)
    if (flux && dansLesAnnees(aussiEn, portee, (a, cible) => supprimerDansLesAnnees(a, flux, cible), "Supprimé aussi sur")) return
    if (portee !== "mois" && flux && openCell) {
      const { grille, touches } = supprimerSerie(monthlyData, flux, openCell.monthIndex, portee)
      setMonthlyData(grille)
      annoncerSerie("Supprimé", touches)
      return
    }
    updateOpenMonthFlows(flows => (flows.some(f => f.id === flowId) ? flows.filter(f => f.id !== flowId) : flows))
  }
  const handleReorderFlows = (reorderedFlows: FinancialFlow[]) => {
    if (!openCell) return
    const { entityId } = openCell
    updateOpenMonthFlows(flows => [...flows.filter(f => f.entityId !== entityId), ...reorderedFlows])
  }

  // ===================================================================================
  // == LOGIQUE DE CALCUL MÉMORISÉE POUR LA GRILLE
  // ===================================================================================
  const gridData = useMemo(() => {
    const finalColors = { ...DEFAULT_FLOW_COLORS, ...preferences.flowTypeColors }

    return entities.map(entity => {
      // Logique pour le 'monthlyScale' des mois
      let maxMonthlyTotal = 0
      monthlyData.forEach(month => {
        const relevantFlows = month.flows.filter(flow => flow.entityId === entity.id)
        const monthlyGains = relevantFlows.filter(flow => !isExpenseFlowType(flow.type)).reduce((sum, flow) => sum + flow.amount, 0)
        const monthlyExpenses = relevantFlows.filter(flow => isExpenseFlowType(flow.type)).reduce((sum, flow) => sum + flow.amount, 0)
        maxMonthlyTotal = Math.max(maxMonthlyTotal, monthlyGains, monthlyExpenses)
      })
      const monthlyScale = maxMonthlyTotal > 0 ? maxMonthlyTotal * 1.1 : 1

      // Logique pour monthlyCellData
      const monthlyCellData = Array.from({ length: 12 }).map((_, monthIndex) => {
        const relevantFlows = monthlyData[monthIndex].flows.filter(flow => flow.entityId === entity.id)
        const aggregatedFlows = new Map<FinancialFlow["type"], number>()
        relevantFlows.forEach(flow => {
          aggregatedFlows.set(flow.type, (aggregatedFlows.get(flow.type) || 0) + flow.amount)
        })

        const gains: FlowSegment[] = [],
          expenses: FlowSegment[] = []
        let totalGains = 0,
          totalExpenses = 0

        aggregatedFlows.forEach((amount, type) => {
          const segment: FlowSegment = { amount, color: finalColors[type] || "#cccccc", number: flowTypeToNumberMap.get(type) || 0 }
          if (isExpenseFlowType(type)) {
            expenses.push(segment)
            totalExpenses += amount
          } else {
            gains.push(segment)
            totalGains += amount
          }
        })
        return { gains, expenses, totalGains, totalExpenses, flowCount: relevantFlows.length }
      })

      // Logique pour calculer 'totalAnnualFlows' et 'annualGains'/'annualExpenses'
      const totalAnnualFlows = new Map<FinancialFlow["type"], number>()
      monthlyData.forEach(month => {
        month.flows
          .filter(flow => flow.entityId === entity.id)
          .forEach(flow => {
            totalAnnualFlows.set(flow.type, (totalAnnualFlows.get(flow.type) || 0) + flow.amount)
          })
      })

      const annualGains: FlowSegment[] = [],
        annualExpenses: FlowSegment[] = []
      let totalAnnualGains = 0,
        totalAnnualExpenses = 0

      totalAnnualFlows.forEach((amount, type) => {
        const segment: FlowSegment = { amount, color: finalColors[type] || "#cccccc", number: flowTypeToNumberMap.get(type) || 0 }
        if (isExpenseFlowType(type)) {
          annualExpenses.push(segment)
          totalAnnualExpenses += amount
        } else {
          annualGains.push(segment)
          totalAnnualGains += amount
        }
      })

      // --- LOGIQUE SPÉCIFIQUE POUR L'ÉCHELLE ANNUELLE ---
      // On trouve la valeur du plus grand segment individuel (gain ou dépense) sur toute l'année.
      const maxAnnualSegmentValue = Math.max(
        ...annualGains.map(s => s.amount),
        ...annualExpenses.map(s => s.amount),
        1 // On ajoute 1 pour éviter une division par zéro si tout est à 0
      )

      const annualFlowCount = monthlyData.reduce((acc, month) => acc + month.flows.filter(f => f.entityId === entity.id).length, 0)

      // On assemble les données annuelles
      const annualCellData = {
        gains: annualGains,
        expenses: annualExpenses,
        totalGains: totalAnnualGains,
        totalExpenses: totalAnnualExpenses,
        flowCount: annualFlowCount
      }

      return { entity, monthlyScale, monthlyCellData, annualCellData, annualScale: maxAnnualSegmentValue * 1.1 }
    })
  }, [monthlyData, entities, preferences, flowTypeToNumberMap])

  // ===================================================================================
  // == RENDU JSX DU COMPOSANT
  // ===================================================================================
  return (
    <>
      <div className="page-paysage p-6 bg-slate-50 dark:bg-gray-950 rounded-lg shadow-md mt-8 print:mt-0 print:p-3">
        <div className="mb-4 flex flex-wrap items-center gap-x-6 gap-y-2">
          <h2 className="text-2xl font-semibold">
            Grille de Saisie Annuelle
            {/* Sur papier, le sélecteur disparaît : le titre dit de quelle année il s'agit. */}
            {annee !== undefined ? <span className="hidden print:inline"> {annee}</span> : null}
          </h2>
          {selecteurAnnee}
        </div>
        {entities.length === 0 ? (
          <p className="text-slate-600 dark:text-slate-400">Veuillez d'abord ajouter une entité pour commencer la saisie.</p>
        ) : (
          // La bande des mois reste collée sous les barres du haut tant que la grille est en vue : elle s'arrête au bas de ce bloc.
          <div>
            {defilement.deborde ? (
              <BandeDesMois
                libelles={months}
                noms={fullMonths}
                flux={fluxDesMois}
                visibles={defilement.visibles}
                auDebut={defilement.auDebut}
                aLaFin={defilement.aLaFin}
                haut={haut}
                onMois={index => defilement.defiler(g => defilementPourLeMois(g, index))}
                onVoisin={sens => defilement.defiler(g => defilementVoisin(g, sens))}
                onGlisser={position => defilement.defiler(g => defilementPourLaPosition(g, position), true)}
              />
            ) : null}
            <div className="relative">
              {/* Une case qui reçoit le focus n'est cachée ni sous la première colonne, fixe (marge de défilement à gauche), ni
                  sous la bande des mois, collée en haut (marge au-dessus des cases). */}
              <div
                ref={zone}
                style={defilement.deborde ? { scrollPaddingLeft: defilement.colonneFixe } : undefined}
                className={cn("relative overflow-x-auto print:overflow-visible", defilement.deborde && "[&_[role=button]]:scroll-mt-14")}
              >
                {/* `w-max` : la grille doit être aussi large que son contenu, sinon la première colonne (sticky) cesse de rester visible une fois la largeur de la fenêtre dépassée.
                    Sur papier, elle tient dans la largeur de la feuille : les douze mois se partagent la place, en petits caractères, et chaque case empile gains et dépenses. */}
                <div className="grid w-max min-w-full gap-px [grid-template-columns:minmax(5rem,6rem)_repeat(13,auto)] sm:[grid-template-columns:minmax(8rem,11rem)_repeat(13,auto)] print:w-full print:text-[9pt] print:[grid-template-columns:6.5rem_auto_repeat(12,minmax(0,1fr))]">
                  {/* En-tête de la grille */}
                  <div data-colonne-fixe className="font-bold sticky left-0 bg-slate-50 dark:bg-gray-950 z-10 p-2 text-sm sm:text-base sm:whitespace-nowrap print:static print:p-1 print:text-[9pt]">Entités / Flux</div>
                  <div className="font-bold text-center p-2 print:p-1">Total Annuel</div>
                  {months.map(month => (
                    <div key={month} data-mois className="font-bold text-center p-2 print:p-1">
                      {month}
                    </div>
                  ))}
                  {/* Corps de la grille */}
                  {gridData.map(({ entity, monthlyScale, monthlyCellData, annualCellData, annualScale }) => (
                    // L'utilisation de React.Fragment est cruciale pour que `position: sticky` fonctionne correctement.
                    <React.Fragment key={entity.id}>
                      {/* Colonne 1 : Nom de l'entité + Avatar */}
                      <div className="font-bold col-span-1 sticky left-0 bg-slate-100 dark:bg-gray-800 z-10 p-2 flex items-center justify-center print:static print:p-1">
                        <div className={cn("flex items-center gap-2 py-1 mx-0 text-sm sm:mx-3 sm:text-base print:mx-0 print:gap-1 print:text-[9pt]", resume ? "max-sm:flex-col" : "flex-col")}>
                          <AvatarDisplay avatar={entity.avatar} size={resume ? "sm" : "md"} />
                          {/* Un nom long passe à la ligne ; un mot plus large que la colonne est coupé. */}
                          <span className="text-center [overflow-wrap:anywhere]">{entity.name}</span>
                        </div>
                      </div>

                      {/* Colonne 2 : Total Annuel */}
                      <div role="group" aria-label={`Total annuel : ${entity.name}`} className="bg-slate-200 dark:bg-gray-700 p-2 flex flex-col justify-start print:p-1">
                        <CellChartDisplay
                          gains={annualCellData.gains}
                          expenses={annualCellData.expenses}
                          totalGains={annualCellData.totalGains}
                          totalExpenses={annualCellData.totalExpenses}
                          absoluteMaxValue={annualScale} // <-- Utilisation de la nouvelle échelle
                          flowCount={annualCellData.flowCount}
                          readOnly
                        />
                      </div>

                      {/* Colonnes 3 à 14 : Les 12 mois */}
                      {monthlyCellData.map((cellData, monthIndex) => (
                        <div
                          key={monthIndex}
                          className={cn("bg-slate-100 dark:bg-gray-800 p-2 group transition-colors cursor-pointer focus-visible:-outline-offset-4 hover:bg-slate-200 dark:hover:bg-gray-700 flex flex-col justify-start print:min-h-0 print:p-1", resume ? "min-h-12" : "min-h-[80px]")}
                          role="button"
                          tabIndex={0}
                          aria-label={`Flux ${deMois(fullMonths[monthIndex])} : ${entity.name}`}
                          onClick={() => setOpenCell({ entityId: entity.id, monthIndex })}
                          onKeyDown={event => {
                            // Une case s'ouvre aussi au clavier, comme un bouton.
                            if (event.key === "Enter" || event.key === " ") {
                              event.preventDefault()
                              setOpenCell({ entityId: entity.id, monthIndex })
                            }
                          }}
                        >
                          <CellChartDisplay gains={cellData.gains} expenses={cellData.expenses} totalGains={cellData.totalGains} totalExpenses={cellData.totalExpenses} absoluteMaxValue={monthlyScale} flowCount={cellData.flowCount} />
                        </div>
                      ))}
                    </React.Fragment>
                  ))}
                </div>
              </div>
              {defilement.deborde ? <FondusDesBords gauche={!defilement.auDebut} droite={!defilement.aLaFin} colonneFixe={defilement.colonneFixe} /> : null}
            </div>
          </div>
        )}
      </div>

      {openCell && openCellEntity && (
        <MonthlyFlowsModal
          key={`${openCell.entityId}-${openCell.monthIndex}`}
          onClose={() => setOpenCell(null)}
          flows={monthlyData[openCell.monthIndex].flows.filter(f => f.entityId === openCell.entityId)}
          entity={openCellEntity}
          monthName={fullMonths[openCell.monthIndex]}
          annee={annee}
          autresAnnees={autresAnnees}
          onCreate={handleCreateFlow}
          onRecopier={openCell.monthIndex < 11 ? handleRecopierFlux : undefined}
          onUpdate={handleUpdateFlow}
          onDelete={handleDeleteFlow}
          onReorder={handleReorderFlows}
        />
      )}
    </>
  )
}

export default MonthlyGrid
