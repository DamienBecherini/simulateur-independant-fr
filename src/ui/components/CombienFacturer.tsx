// src/ui/components/CombienFacturer.tsx
// « Combien facturer ? » : le calcul à l'envers du comparateur. Pour un net du foyer visé, le chiffre d'affaires annuel
// et mensuel de l'activité comparée dans chaque statut, avec les réglages du comparateur, et l'écart avec celui saisi.
// Sur téléphone, une carte par statut au lieu du tableau ; dans l'affichage « Résumé », une section à déplier.

import { useCallback, useId, useState } from "react"
import { Label } from "@/components/ui/label"
import { ecartAvecLeChiffreDAffairesSaisi, lireLeNetVise, parMois, phraseDuCalculALEnvers, raisonHorsDePortee } from "@/lib/combien-facturer"
import { ecartSigne, euros } from "@/backend/logic/format"
import { cn } from "@/lib/utils"
import { ligneAlternee } from "../lignes-alternees"
import type { ChiffreDAffairesDUnStatut, ChiffreDAffairesPourUnNet, ComparaisonOptions, Entity, SessionState } from "@/types"
import { useAffichageResume } from "../hooks/useAffichage"
import { useCalculDiffere } from "../hooks/useCalculDiffere"
import { ChampNumerique } from "./ChampNumerique"
import { Depliable } from "./Depliable"
import { ZoneDefilante } from "./ZoneDefilante"

/** Recalcule peu après chaque modification du net visé, de la session ou des réglages ; rien sans net visé. */
function useCalculALEnvers(session: SessionState, options: ComparaisonOptions, netVise: number | null, annee: number) {
  const calculer = useCallback(() => window.api.chiffreDAffairesPourUnNet(session, options, netVise ?? 0, annee), [session, options, netVise, annee])
  return useCalculDiffere(calculer, { echec: "Le calcul du chiffre d'affaires nécessaire a échoué.", actif: netVise !== null })
}

const mention = "block text-xs font-normal text-slate-600 dark:text-slate-400"

/** Le chiffre d'affaires annuel d'un statut, ou pourquoi il est hors de portée. */
function ChiffreDAffairesAnnuel({ colonne }: { colonne: ChiffreDAffairesDUnStatut }) {
  const raison = raisonHorsDePortee(colonne)
  if (colonne.chiffreDAffaires === null) {
    return (
      <>
        —<span className="block text-xs font-medium text-amber-800 dark:text-amber-300">{raison}</span>
      </>
    )
  }
  return (
    <>
      {euros(colonne.chiffreDAffaires)}
      {colonne.chiffreDAffaires === 0 ? <span className={mention}>déjà atteint sans chiffre d'affaires</span> : null}
    </>
  )
}

const ecartAvecLeSaisi = (colonne: ChiffreDAffairesDUnStatut, saisi: number) => {
  const ecart = ecartAvecLeChiffreDAffairesSaisi(colonne, saisi)
  return ecart === null ? "—" : ecartSigne(ecart)
}

const parMoisDe = (colonne: ChiffreDAffairesDUnStatut) => (colonne.chiffreDAffaires === null ? "—" : euros(parMois(colonne.chiffreDAffaires)))

function TableauDuCalcul({ resultat, activityName }: { resultat: ChiffreDAffairesPourUnNet; activityName: string }) {
  const cellule = "px-3 py-2 text-right tabular-nums"
  return (
    <ZoneDefilante libelle="Chiffre d'affaires nécessaire par statut" className="rounded-lg border border-slate-200 max-sm:hidden print:block dark:border-slate-700">
      <table className="w-full min-w-[36rem] text-sm">
        <caption className="sr-only">
          Chiffre d'affaires de « {activityName} » nécessaire pour {euros(resultat.netVise)} nets par an, selon le statut
        </caption>
        <thead className="bg-slate-100 dark:bg-slate-800/80">
          <tr>
            <th scope="col" className="px-3 py-2 text-left font-medium">
              Statut
            </th>
            <th scope="col" className="px-3 py-2 text-right font-medium">
              Chiffre d'affaires annuel
            </th>
            <th scope="col" className="px-3 py-2 text-right font-medium">
              Par mois
            </th>
            <th scope="col" className="px-3 py-2 text-right font-medium">
              Écart avec le chiffre d'affaires saisi ({euros(resultat.chiffreDAffairesSaisi)})
            </th>
          </tr>
        </thead>
        <tbody>
          {resultat.colonnes.map((c, rang) => (
            <tr key={c.statut} className={cn("border-t border-slate-200 align-top dark:border-slate-700", ligneAlternee(rang))}>
              <th scope="row" className="px-3 py-2 text-left font-medium text-slate-700 dark:text-slate-200">
                {c.libelle}
                {c.telleQueSaisie ? <span className={mention}>actuel</span> : null}
              </th>
              <td className={cn(cellule, "font-semibold")}>
                <ChiffreDAffairesAnnuel colonne={c} />
              </td>
              <td className={cellule}>{parMoisDe(c)}</td>
              <td className={cellule}>{ecartAvecLeSaisi(c, resultat.chiffreDAffairesSaisi)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </ZoneDefilante>
  )
}

/** Sous le titre d'une carte : pourquoi le statut est hors de portée, ou le montant mensuel et l'écart avec le chiffre d'affaires saisi. */
function DetailDeLaCarte({ colonne, saisi }: { colonne: ChiffreDAffairesDUnStatut; saisi: number }) {
  const raison = raisonHorsDePortee(colonne)
  if (raison) return <p className="text-xs font-medium text-amber-800 dark:text-amber-300">{raison}</p>
  const parties = [colonne.chiffreDAffaires === 0 ? "déjà atteint sans chiffre d'affaires" : `soit ${parMoisDe(colonne)} par mois`, ecartAvecLeChiffreDAffairesSaisi(colonne, saisi) === null ? null : `${ecartAvecLeSaisi(colonne, saisi)} par rapport au chiffre d'affaires saisi`]
  return <p className="text-xs text-slate-600 tabular-nums dark:text-slate-400">{parties.filter(Boolean).join(" · ")}</p>
}

/** Sur téléphone, une carte par statut : le tableau n'a pas à défiler en largeur. */
function CartesDuCalcul({ resultat }: { resultat: ChiffreDAffairesPourUnNet }) {
  return (
    <ul aria-label="Chiffre d'affaires nécessaire selon le statut" className="space-y-2 sm:hidden print:hidden">
      {resultat.colonnes.map(c => (
        <li key={c.statut} className="rounded-lg border border-slate-200 px-3 py-2 dark:border-slate-700">
          <div className="flex items-baseline justify-between gap-3">
            <p className="min-w-0 font-medium text-slate-800 dark:text-slate-100">
              {c.libelle}
              {c.telleQueSaisie ? <span className="font-normal text-slate-600 dark:text-slate-400"> · actuel</span> : null}
            </p>
            <p className="shrink-0 text-right font-semibold tabular-nums">{c.chiffreDAffaires === null ? "—" : euros(c.chiffreDAffaires)}</p>
          </div>
          <DetailDeLaCarte colonne={c} saisi={resultat.chiffreDAffairesSaisi} />
        </li>
      ))}
    </ul>
  )
}

/** Le résultat du calcul, à jour pour le net visé saisi : la phrase de réponse est annoncée par la zone d'état, au-dessus. */
function ResultatsDuCalcul({ resultat, activityName }: { resultat: ChiffreDAffairesPourUnNet; activityName: string }) {
  return (
    <>
      <CartesDuCalcul resultat={resultat} />
      <TableauDuCalcul resultat={resultat} activityName={activityName} />
      {resultat.warnings.length > 0 ? (
        <ul className="list-inside list-disc text-sm text-amber-800 dark:text-amber-200/90">
          {resultat.warnings.map(w => (
            <li key={w}>{w}</li>
          ))}
        </ul>
      ) : null}
      <p className="text-sm text-slate-600 dark:text-slate-400">
        Le chiffre d'affaires saisi est mis à l'échelle avec la même répartition entre les mois et entre ventes et prestations (BIC, BNC) ; charges, autres revenus et réglages du comparateur ne changent pas. Le net ne monte pas toujours régulièrement avec le chiffre d'affaires (fin de l'ACRE, seuils, plafonds) : chaque montant atteint le net visé, et un euro de moins ne l'atteint pas.
      </p>
    </>
  )
}

/** Ce que la zone d'état annonce : la réponse, « Calcul en cours… », ou rien sans net visé ou après un échec (dit à part). */
function etatDuCalcul(netVise: number | null, resultat: ChiffreDAffairesPourUnNet | null, erreur: string | null): string {
  if (netVise === null || erreur) return ""
  return resultat ? phraseDuCalculALEnvers(resultat) : "Calcul en cours…"
}

interface CombienFacturerProps {
  session: SessionState
  annee: number
  /** Les réglages du comparateur pour l'activité comparée : le calcul les reprend tels quels. */
  options: ComparaisonOptions
  activityName: string
}

/** Rien sans activité comparée (le comparateur ne compare alors que les couples). */
export function CombienFacturer({ activite, ...props }: Omit<CombienFacturerProps, "activityName"> & { activite: Entity | undefined }) {
  return activite ? <CalculALEnvers activityName={activite.name} {...props} /> : null
}

const TITRE = "Combien facturer pour un net visé ?"
const ID_DU_TITRE = "combien-facturer-titre"
const CADRE = "space-y-3 rounded-lg border border-slate-200 p-4 dark:border-slate-700"

/**
 * Dans l'affichage « Résumé », la section tient sur une ligne à déplier (son état est retenu), pour ne pas allonger la
 * page ; dans l'affichage classique, elle est affichée telle quelle, sous son titre.
 */
function CalculALEnvers(props: CombienFacturerProps) {
  if (useAffichageResume()) {
    return (
      <section aria-labelledby={ID_DU_TITRE} className="text-sm text-slate-700 dark:text-slate-200">
        <Depliable titre={<span id={ID_DU_TITRE}>{TITRE}</span>} id="comparateur-combien-facturer">
          <div className={cn(CADRE, "mt-2")}>
            <ContenuDuCalcul {...props} />
          </div>
        </Depliable>
      </section>
    )
  }
  return (
    <section aria-labelledby={ID_DU_TITRE} className={CADRE}>
      <h3 id={ID_DU_TITRE} className="text-lg font-medium text-slate-800 dark:text-slate-100">
        {TITRE}
      </h3>
      <ContenuDuCalcul {...props} />
    </section>
  )
}

function ContenuDuCalcul({ session, annee, options, activityName }: CombienFacturerProps) {
  const [saisie, setSaisie] = useState("")
  const netVise = lireLeNetVise(saisie)
  const { resultat, erreur } = useCalculALEnvers(session, options, netVise, annee)
  // Un résultat d'un autre net visé (calcul en cours après une frappe) n'est pas montré.
  const aJour = resultat !== null && netVise !== null && resultat.netVise === netVise ? resultat : null
  const idChamp = useId()
  const idAide = useId()
  return (
    <>
      <p className="text-sm text-slate-600 dark:text-slate-300">Le calcul à l'envers du tableau : pour le net annuel que vous visez, le chiffre d'affaires de « {activityName} » nécessaire dans chaque statut.</p>
      <div className="flex flex-wrap items-center gap-3">
        <Label htmlFor={idChamp}>Net visé du foyer (€ par an)</Label>
        <ChampNumerique id={idChamp} className="w-40" min="0" step="1000" quoi="le net visé" placeholder="30000" value={saisie} onChange={e => setSaisie(e.target.value)} aria-describedby={idAide} />
      </div>
      <p id={idAide} className="text-xs text-slate-600 dark:text-slate-400">
        Net après cotisations et impôts de toute la simulation, comme la ligne « Net dans la poche » du tableau.
      </p>
      {erreur && netVise !== null ? <p className="text-sm text-red-800 dark:text-red-200">{erreur}</p> : null}
      {/* Zone annoncée sans rôle « status » : celui-ci reste au verdict du comparateur, plus haut. */}
      <p aria-live="polite" aria-atomic="true" className="text-sm font-medium text-slate-800 dark:text-slate-100">
        {etatDuCalcul(netVise, aJour, erreur)}
      </p>
      {aJour ? <ResultatsDuCalcul resultat={aJour} activityName={activityName} /> : null}
    </>
  )
}
