// src/ui/components/ProtectionDesStatuts.tsx
// Ce que recouvre la note de protection sociale du comparateur : un tableau aux mêmes colonnes que lui, une ligne par
// garantie (retraite, arrêt maladie, invalidité-décès, accident du travail, chômage), les étoiles en tête de colonne et
// les trimestres de la simulation en dernière ligne. Un tableau plutôt que des onglets : il sert à comparer les statuts,
// que des onglets montreraient un à un. Le résumé de chaque régime reste à lire dans la bulle de sa colonne.

import { GARANTIES_SOCIALES, type GarantieSociale, type NiveauDeGarantie, type ScenarioStatut } from "@/types"
import { cn } from "@/lib/utils"
import { AideEnBulle, BULLE_NEUTRE } from "./Bulle"
import { Depliable } from "./Depliable"
import { ZoneDefilante } from "./ZoneDefilante"

const LIBELLES_DES_GARANTIES: Record<GarantieSociale, string> = {
  retraite: "Retraite",
  arretMaladie: "Arrêt maladie",
  invaliditeDeces: "Invalidité, décès",
  accidentDuTravail: "Accident du travail",
  chomage: "Chômage"
}

const etoiles = (n: number) => "★".repeat(n) + "☆".repeat(5 - n)

/** Une garantie dans sa case : ✓, ✗, « faible », ou la limite (« après 1 an »). */
function NiveauDansLaCase({ garantie }: { garantie: NiveauDeGarantie }) {
  if (garantie.niveau === "oui")
    return (
      <>
        <span aria-hidden="true" className="font-semibold text-emerald-700 dark:text-emerald-400">
          ✓
        </span>
        <span className="sr-only">oui</span>
      </>
    )
  if (garantie.niveau === "non")
    return (
      <>
        <span aria-hidden="true" className="text-slate-500 dark:text-slate-400">
          ✗
        </span>
        <span className="sr-only">non</span>
      </>
    )
  return <span className="text-amber-800 dark:text-amber-300">{garantie.niveau === "faible" ? "faible" : garantie.precision}</span>
}

const CASE = "px-3 py-1.5 text-center"
const EN_TETE_DE_LIGNE = "sticky left-0 z-10 bg-white px-3 py-1.5 text-left font-medium dark:bg-slate-950"

/** Le tableau des garanties ; replié, comme une aide, avec son état retenu. */
export function ProtectionDesStatuts({ scenarios }: { scenarios: ScenarioStatut[] }) {
  if (scenarios.length === 0) return null
  return (
    // L'étoile du titre renvoie aux étoiles de la ligne « Protection sociale » du tableau, juste au-dessus ; les lecteurs
    // d'écran lisent « la note en étoiles ».
    <Depliable
      titre={
        <span>
          Ce que recouvre la note en{" "}
          <span aria-hidden="true" className="text-amber-600 dark:text-amber-400">
            ★
          </span>
          <span className="sr-only">étoiles</span> de protection sociale
        </span>
      }
      id="comparateur-note-protection"
      className="text-sm text-slate-600 dark:text-slate-300"
    >
      <ZoneDefilante libelle="Tableau de la protection sociale" className="mt-2 rounded-lg border border-slate-200 dark:border-slate-700">
        <table aria-label="Protection sociale selon le statut" className="w-full min-w-[40rem] bg-white text-sm text-slate-800 print:min-w-0 dark:bg-slate-950 dark:text-slate-100">
          <thead className="bg-slate-100 dark:bg-slate-800/80">
            <tr>
              <th scope="col" className={cn(EN_TETE_DE_LIGNE, "bg-slate-100 dark:bg-slate-800")}>
                <span className="sr-only">Garantie</span>
              </th>
              {scenarios.map(s => (
                <th key={s.statut} scope="col" className="px-3 py-1.5 text-center align-bottom font-medium">
                  {s.libelle}
                  <span aria-hidden="true" className="block tracking-wider text-amber-600 dark:text-amber-400">
                    {etoiles(s.protectionSociale.etoiles)}
                  </span>
                  <span className="sr-only"> : {s.protectionSociale.etoiles} sur 5</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {GARANTIES_SOCIALES.map(garantie => (
              <tr key={garantie}>
                <th scope="row" className={EN_TETE_DE_LIGNE}>
                  {LIBELLES_DES_GARANTIES[garantie]}
                </th>
                {scenarios.map(s => (
                  <td key={s.statut} className={CASE}>
                    <NiveauDansLaCase garantie={s.protectionSociale.garanties[garantie]} />
                  </td>
                ))}
              </tr>
            ))}
            <tr>
              <th scope="row" className={EN_TETE_DE_LIGNE}>
                Trimestres de retraite
              </th>
              {scenarios.map(s => (
                <td key={s.statut} className={cn(CASE, "tabular-nums")}>
                  {s.protectionSociale.trimestres} / 4
                </td>
              ))}
            </tr>
            <tr className="print:hidden">
              <th scope="row" className={EN_TETE_DE_LIGNE}>
                En détail
              </th>
              {scenarios.map(s => (
                <td key={s.statut} className={CASE}>
                  <AideEnBulle libelle={`Protection sociale en ${s.libelle}`} texte={s.protectionSociale.resume} teinte={BULLE_NEUTRE} />
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </ZoneDefilante>
      <p className="mt-2 text-slate-600 dark:text-slate-400">Frais de santé couverts dans tous les statuts. « faible » : proportionnelle au chiffre d'affaires, sans minimum. Les trimestres viennent de votre simulation ; les garanties dépendent du statut.</p>
      <p className="mt-1 text-slate-600 dark:text-slate-400">Note indicative : la cinquième étoile correspond au salarié, seul à cotiser à l'assurance chômage, comme en portage salarial avec 4 trimestres.</p>
    </Depliable>
  )
}
