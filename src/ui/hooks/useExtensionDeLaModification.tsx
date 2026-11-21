// src/ui/hooks/useExtensionDeLaModification.tsx

import { useState, type ReactNode } from "react"
import { toast } from "sonner"
import type { FinancialFlow } from "@/types"
import type { ChangementsDeFlux, PorteeRecurrence, SerieAilleurs } from "@/lib/flux-recurrents"
import type { FlowChanges } from "../components/FlowItem"
import { ExtensionDeLaModification, type DerniereOperation } from "../components/ExtensionDeLaModification"

interface Options {
  /** Les flux du mois ouvert, pour cet acteur. */
  flows: FinancialFlow[]
  /** Le mois ouvert (« Juillet »). */
  mois: string
  onUpdate: (flowId: string, changes: FlowChanges) => void
  onDelete: (flowId: string) => void
  serieAilleurs?: (avant: FinancialFlow) => SerieAilleurs
  onEtendre?: (avant: FinancialFlow, changements: ChangementsDeFlux | null, portee: PorteeRecurrence, aussiEn: number[]) => void
  onRestaurer?: (flux: FinancialFlow, rang: number) => void
}

/** Les seuls changements qui modifient le flux : un champ quitté sans changement n'est pas une modification. */
function changementsReels(flux: FinancialFlow, changes: FlowChanges): ChangementsDeFlux {
  return Object.fromEntries(Object.entries(changes).filter(([cle, valeur]) => flux[cle as keyof FlowChanges] !== valeur))
}

/**
 * Modifications et retraits dans la fenêtre d'un mois : ils ne valent que pour ce mois, puis la barre propose de faire
 * de même dans les autres mois et années où le flux existe (voir ExtensionDeLaModification). Des modifications
 * successives du même flux s'y cumulent, repérées d'après le flux tel qu'il était avant la première : un libellé
 * changé puis un montant changé s'étendent ensemble. Renvoie les gestes de la liste (modifier, retirer), la barre à
 * placer après la ligne modifiée ou au rang du flux retiré, et `oublier`, qui la fait disparaître (un ajout).
 */
export function useExtensionDeLaModification({ flows, mois, onUpdate, onDelete, serieAilleurs, onEtendre, onRestaurer }: Options) {
  const [derniere, setDerniere] = useState<DerniereOperation | null>(null)

  const precedente = (flux: FinancialFlow) => (derniere?.changements && derniere.avant.id === flux.id ? derniere : null)
  const retirer = (flowId: string) => {
    const flux = flows.find(f => f.id === flowId)
    if (!flux) return
    onDelete(flowId)
    setDerniere({ avant: precedente(flux)?.avant ?? flux, changements: null, flux, rang: flows.indexOf(flux) })
  }
  // Un montant ramené à 0 € retire le flux au lieu de laisser une ligne à 0 € : elle ne compte pour rien dans le
  // calcul, mais occupe sa case et fait croire qu'un revenu ou une charge est saisi.
  const modifier = (flowId: string, changes: FlowChanges) => {
    const flux = flows.find(f => f.id === flowId)
    if (!flux) return
    if (changes.amount === 0) {
      retirer(flowId)
      toast.info("Montant à 0 € : le flux est retiré.")
      return
    }
    const reels = changementsReels(flux, changes)
    if (Object.keys(reels).length === 0) return
    onUpdate(flowId, changes)
    const cumul = precedente(flux)
    setDerniere({ avant: cumul?.avant ?? flux, changements: { ...cumul?.changements, ...reels }, flux: { ...flux, ...reels }, rang: flows.indexOf(flux) })
  }
  const etendre = (portee: PorteeRecurrence, aussiEn: number[]) => {
    if (derniere) onEtendre?.(derniere.avant, derniere.changements, portee, aussiEn)
    setDerniere(null)
  }
  const annulerLeRetrait = () => {
    if (derniere) onRestaurer?.(derniere.flux, derniere.rang)
    setDerniere(null)
  }

  const barre: ReactNode =
    derniere && serieAilleurs && onEtendre ? (
      <ExtensionDeLaModification key={`${derniere.avant.id}-${derniere.changements ? "modification" : "retrait"}`} operation={derniere} mois={mois.toLowerCase()} serie={serieAilleurs(derniere.avant)} onEtendre={etendre} onFermer={() => setDerniere(null)} onAnnulerLeRetrait={annulerLeRetrait} />
    ) : null
  return {
    modifier,
    retirer,
    oublier: () => setDerniere(null),
    /** La barre d'une modification suit la ligne modifiée. */
    barreApres: (flowId: string) => (derniere?.changements && derniere.avant.id === flowId ? barre : null),
    /** Celle d'un retrait prend la place du flux retiré. */
    barreAuRang: (rang: number) => (derniere && derniere.changements === null && derniere.rang === rang ? barre : null)
  }
}
