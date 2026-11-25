// src/ui/components/ChampDateDeCreation.tsx
// Date de création d'une activité (mois et année) et, pour une micro-entreprise, le dépassement des plafonds l'année qui
// précède la session : ils bornent l'ACRE, l'exonération de CFE et la sortie du régime micro (voir dispositifs.ts), et
// réduisent l'année de création aux mois d'activité (voir l'ADR 020).

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { ecrireMois, libelleDuMois, lireMois } from "@/backend/logic/dispositifs"
import { periodeDeLActivite } from "@/backend/logic/annee-de-creation"
import { ANNEE_PAR_DEFAUT, type Company, type MicroEntreprise } from "@/types"

/** Valeur des listes quand rien n'est choisi : une liste Radix n'accepte pas de valeur vide. */
const AUCUNE = "aucune"
const MOIS = Array.from({ length: 12 }, (_, i) => i + 1)
/** Trente ans en arrière, dix en avant : de quoi décrire une activité existante comme un projet. */
const ANNEES = Array.from({ length: 41 }, (_, i) => ANNEE_PAR_DEFAUT - 30 + i)

const aide = "mt-1 text-sm text-slate-600 dark:text-slate-400"

interface Props<T extends Company | MicroEntreprise> {
  activite: T
  onChange: (activite: T) => void
}

/** Ce que la date de création change, selon la forme de l'activité. */
function effetDeLaDate(activite: Company | MicroEntreprise): string {
  if (activite.type === "micro-entreprise") return "L'année de création, les plafonds du régime et les seuils de franchise de TVA sont réduits au prorata des jours d'activité ; elle décide aussi de l'ACRE (mois couverts) et de la CFE."
  const impot = activite.legalStatus === "EI" ? "" : ", comme la tranche d'impôt sur les sociétés à 15 %"
  return `L'année de création, les cotisations se calculent sur un plafond de la sécurité sociale réduit aux mois d'activité${impot} ; elle décide aussi de la CFE du comparateur.`
}

/** L'année affichée pour l'activité : année de création (mois d'activité) ou année d'avant ; rien pour une année entière. */
function AnneeAffichee({ dateDeCreation, annee, micro }: { dateDeCreation: string | undefined; annee: number; micro: boolean }) {
  const periode = periodeDeLActivite(dateDeCreation, annee)
  if (periode.cas === "entiere") return null
  const texte =
    periode.cas === "creation" ? (
      <>
        <strong className="font-semibold">
          En {annee} : {periode.mois} mois d'activité
        </strong>{" "}
        ({libelleDuMois(periode.creation, false)} à décembre).
      </>
    ) : (
      <>
        <strong className="font-semibold">En {annee} : avant la création.</strong>{" "}
        {micro ? "Les montants saisis cette année sont signalés." : "L'activité n'est pas encore affiliée : ni cotisation minimale ni forfait."}
      </>
    )
  return (
    <p role="status" className="mt-2 rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-900 dark:border-blue-900 dark:bg-blue-950/60 dark:text-blue-100">
      {texte}
    </p>
  )
}

/**
 * Mois et année de création. Choisir l'un sans l'autre complète l'autre (janvier, ou l'année par défaut) ; « Non
 * renseignée » dans l'une des listes efface la date : sans elle, l'ACRE et la CFE valent pour toute l'année, comme avant.
 */
export function ChampDateDeCreation<T extends Company | MicroEntreprise>({ activite, onChange, annee: anneeAffichee }: Props<T> & { annee: number }) {
  const date = lireMois(activite.dateDeCreation)
  const changer = (mois: string, annee: string) => {
    const dateDeCreation = mois === AUCUNE || annee === AUCUNE ? undefined : ecrireMois({ annee: Number(annee), mois: Number(mois) })
    onChange({ ...activite, dateDeCreation })
  }
  const mois = date ? String(date.mois) : AUCUNE
  const annee = date ? String(date.annee) : AUCUNE
  // Choisir un mois sans année prend l'année par défaut ; une année sans mois prend janvier.
  const choisirMois = (valeur: string) => changer(valeur, annee === AUCUNE ? String(ANNEE_PAR_DEFAUT) : annee)
  const choisirAnnee = (valeur: string) => changer(mois === AUCUNE ? "1" : mois, valeur)

  return (
    <div className="grid grid-cols-4 items-start gap-4">
      <span id="date-de-creation" className="pt-2 text-right text-sm font-medium">
        Date de création
      </span>
      <div className="col-span-3">
        <div role="group" aria-labelledby="date-de-creation" aria-describedby="date-de-creation-aide" className="flex flex-wrap gap-2">
          <Select value={mois} onValueChange={choisirMois}>
            <SelectTrigger aria-label="Mois de création" className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={AUCUNE}>Non renseignée</SelectItem>
              {MOIS.map(m => (
                <SelectItem key={m} value={String(m)}>
                  {libelleDuMois({ annee: ANNEE_PAR_DEFAUT, mois: m }, false)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={annee} onValueChange={choisirAnnee}>
            <SelectTrigger aria-label="Année de création" className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={AUCUNE}>Non renseignée</SelectItem>
              {ANNEES.map(a => (
                <SelectItem key={a} value={String(a)}>
                  {a}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <AnneeAffichee dateDeCreation={activite.dateDeCreation} annee={anneeAffichee} micro={activite.type === "micro-entreprise"} />
        <p id="date-de-creation-aide" className={aide}>
          Début d'activité déclaré. {effetDeLaDate(activite)} Sans date, l'activité compte toute l'année.
        </p>
      </div>
    </div>
  )
}

/**
 * Micro-entreprise au-delà des plafonds l'année qui précède la première année simulée : un nouveau dépassement la
 * première année la fait sortir du régime micro au 1er janvier suivant. Les années plus anciennes ne comptent pas.
 */
export function ChampHorsPlafondAnneePrecedente({ activite, onChange }: Props<MicroEntreprise>) {
  return (
    <div className="grid grid-cols-4 items-start gap-4">
      <span className="text-right text-sm font-medium" aria-hidden="true" />
      <div className="col-span-3">
        <label className="flex items-center gap-2 text-sm pointer-coarse:min-h-11">
          <Switch checked={activite.horsPlafondAnneePrecedente === true} aria-describedby="hors-plafond-aide" onCheckedChange={coche => onChange({ ...activite, horsPlafondAnneePrecedente: coche || undefined })} />
          Chiffre d'affaires au-delà des plafonds l'année d'avant la simulation
        </label>
        <p id="hors-plafond-aide" className={aide}>
          Deux années de suite au-delà des plafonds font sortir du régime micro au 1er janvier suivant. La simulation suit ses propres années ; cochez si l'année qui précède la première année simulée était déjà au-delà.
        </p>
      </div>
    </div>
  )
}
