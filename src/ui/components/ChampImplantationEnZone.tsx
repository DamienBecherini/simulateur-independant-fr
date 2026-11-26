// src/ui/components/ChampImplantationEnZone.tsx
// Fiche d'une activité : « Aides liées au lieu d'implantation », l'exonération d'impôt sur les bénéfices en zone franche
// urbaine (ZFU-TE) ou en quartier prioritaire (QPV). Dispositif de niche (ADR 017) : une section repliée, une case, et
// rien d'autre tant qu'elle n'est pas cochée. Le régime et son calendrier se déduisent de la date de création ; les
// hypothèses du calcul, tirées des règles de l'année, sont montrées à qui coche la case.

import { useId, useState } from "react"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { descriptionDeLaZone } from "@/backend/logic/exoneration-de-zone"
import type { ReglesFiscales } from "@/backend/logic/regles"
import type { Company, MicroEntreprise } from "@/types"
import { ChampNumerique } from "./ChampNumerique"
import { Depliable } from "./Depliable"

/** Carte officielle des quartiers prioritaires et des zones franches urbaines, pour vérifier une adresse. */
const CARTE_DES_ZONES = "https://sig.ville.gouv.fr/"

const aide = "text-sm text-slate-600 dark:text-slate-400"

interface Props<T extends Company | MicroEntreprise> {
  activite: T
  onChange: (activite: T) => void
  /** L'année affichée et ses règles : le calendrier de l'exonération et ses hypothèses en viennent. */
  annee: number
  regles: ReglesFiscales
}

export function ChampImplantationEnZone<T extends Company | MicroEntreprise>({ activite, onChange, annee, regles }: Props<T>) {
  const id = useId()
  const zone = activite.implantationEnZone
  // Ouverte d'office pour une activité déjà déclarée en zone ; l'état de départ ne change pas quand on coche ou décoche,
  // sans quoi décocher la case refermerait la section sous le doigt.
  const [ouverteAuDepart] = useState(zone !== undefined)
  const description = descriptionDeLaZone(activite, annee, regles)
  // Le texte du champ est gardé tel que tapé : on peut le vider pour retaper une valeur, sans qu'il revienne à 100.
  const [saisie, setSaisie] = useState(() => String(Math.round((zone?.partDuChiffreDAffaires ?? 1) * 100)))
  const changerLaPart = (texte: string) => {
    setSaisie(texte)
    const valeur = Number.parseFloat(texte)
    if (!Number.isFinite(valeur)) return
    const partDuChiffreDAffaires = Math.min(100, Math.max(0, valeur)) / 100
    // À 100 %, la part n'est pas enregistrée : c'est la valeur par défaut.
    onChange({ ...activite, implantationEnZone: partDuChiffreDAffaires < 1 ? { partDuChiffreDAffaires } : {} })
  }
  const cocher = (cochee: boolean) => {
    setSaisie("100")
    onChange({ ...activite, implantationEnZone: cochee ? {} : undefined })
  }

  return (
    <div className="border-t pt-4">
      <Depliable titre="Aides liées au lieu d'implantation" ouverteParDefaut={ouverteAuDepart} className="text-sm">
        <div className="mt-3 space-y-3">
          <label className="flex items-center gap-2 text-sm pointer-coarse:min-h-11">
            <Switch checked={zone !== undefined} aria-describedby={`${id}-aide`} onCheckedChange={cocher} />
            Activité implantée en zone franche urbaine (ZFU-TE) ou en quartier prioritaire (QPV)
          </label>
          <p id={`${id}-aide`} className={aide}>
            Son bénéfice est exonéré d'impôt, en tout ou partie, pendant ses premières années. Le régime et le taux de chaque année se déduisent de la date de création.{" "}
            <a href={CARTE_DES_ZONES} target="_blank" rel="noreferrer" className="text-blue-700 underline underline-offset-2 hover:no-underline dark:text-blue-300">
              Vérifier une adresse sur la carte officielle
            </a>
            .
          </p>
          {description ? (
            <>
              <p role="status" className="rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-950 dark:border-blue-900 dark:bg-blue-950/40 dark:text-blue-100">
                {description.texte}
              </p>
              <div className="grid grid-cols-1 items-center gap-2 sm:grid-cols-[auto_8rem]">
                <Label htmlFor={`${id}-part`}>Part du chiffre d'affaires réalisée dans la zone (%)</Label>
                <ChampNumerique id={`${id}-part`} min="0" max="100" step="any" pas={5} quoi="la part du chiffre d'affaires réalisée dans la zone" aria-describedby={`${id}-part-aide`} value={saisie} onChange={e => changerLaPart(e.target.value)} />
              </div>
              <p id={`${id}-part-aide`} className={aide}>
                Seul le bénéfice réalisé dans la zone est exonéré.
              </p>
              {activite.type === "micro-entreprise" && activite.opteVFL ? <p className={aide}>Avec le versement libératoire, l'exonération ne s'applique pas : elle porte sur un bénéfice, le versement libératoire sur le chiffre d'affaires.</p> : null}
              {description.hypotheses.length > 0 ? (
                <div>
                  <h4 id={`${id}-hypotheses`} className="text-sm font-medium text-slate-800 dark:text-slate-100">
                    Ce que ce calcul suppose
                  </h4>
                  <ul aria-labelledby={`${id}-hypotheses`} className={`mt-1 list-disc space-y-1 pl-5 ${aide}`}>
                    {description.hypotheses.map(hypothese => (
                      <li key={hypothese}>{hypothese}</li>
                    ))}
                  </ul>
                  <p className={`mt-1 ${aide}`}>Les conditions d'accès au régime (taille, activité, emploi) ne sont pas vérifiées : l'avertissement de l'activité les détaille (« Voir les conditions »).</p>
                </div>
              ) : null}
            </>
          ) : null}
        </div>
      </Depliable>
    </div>
  )
}
