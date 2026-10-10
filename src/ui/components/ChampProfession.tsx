// src/ui/components/ChampProfession.tsx
// Profession libérale réglementée d'une activité BNC (micro-entreprise, entreprise individuelle au réel, gérant
// d'EURL), et la part conventionnée de ses recettes quand elle peut être conventionnée (voir l'ADR 015).

import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectSeparator, SelectTrigger, SelectValue } from "@/components/ui/select"
import { avecLaProfession, estConventionnable, groupesDeProfessions, informationSurLaProfession, LIBELLE_NON_REGLEMENTEE, PROFESSION_NON_REGLEMENTEE } from "@/lib/professions"
import { reglesDeLAnneeAffichee } from "@/lib/regles-affichees"
import type { Company, MicroEntreprise } from "@/types"
import { ChampNumerique } from "./ChampNumerique"

const aide = "mt-1 text-sm text-slate-600 dark:text-slate-400"

interface Props<T extends Company | MicroEntreprise> {
  activite: T
  onChange: (activite: T) => void
}

interface PropsDuChamp<T extends Company | MicroEntreprise> extends Props<T> {
  /** L'année affichée : la liste et la ligne d'information décrivent ses règles (taux, caisse), pas celles d'une autre. */
  annee: number
}

export function ChampProfession<T extends Company | MicroEntreprise>({ activite, onChange, annee }: PropsDuChamp<T>) {
  const regles = reglesDeLAnneeAffichee(annee)
  const { groupes, autres } = groupesDeProfessions(regles)
  return (
    <>
      <div className="grid grid-cols-4 items-start gap-4">
        <label htmlFor="profession" className="pt-2 text-right text-sm font-medium">
          Profession
        </label>
        <div className="col-span-3">
          <Select value={activite.profession ?? PROFESSION_NON_REGLEMENTEE} onValueChange={id => onChange(avecLaProfession(activite, id, regles))}>
            <SelectTrigger id="profession" aria-describedby="profession-aide" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={PROFESSION_NON_REGLEMENTEE}>{LIBELLE_NON_REGLEMENTEE}</SelectItem>
              {groupes.map(groupe => (
                <SelectGroup key={groupe.titre}>
                  <SelectSeparator />
                  <SelectLabel>{groupe.titre}</SelectLabel>
                  {groupe.professions.map(p => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.libelle}
                    </SelectItem>
                  ))}
                </SelectGroup>
              ))}
              <SelectSeparator />
              {autres.map(p => (
                <SelectItem key={p.id} value={p.id}>
                  {p.libelle}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p id="profession-aide" className={aide}>
            {informationSurLaProfession(activite, regles)}
          </p>
        </div>
      </div>
      {estConventionnable(activite, regles) ? <ChampPartConventionnee activite={activite} onChange={onChange} /> : null}
    </>
  )
}

/** Part des recettes conventionnées, en pourcentage ; 100 % par défaut, enregistrée en fraction. */
function ChampPartConventionnee<T extends Company | MicroEntreprise>({ activite, onChange }: Props<T>) {
  return (
    <div className="grid grid-cols-4 items-center gap-4">
      <label htmlFor="partConventionnee" className="text-right text-sm font-medium">
        Part conventionnée (%)
      </label>
      <div className="col-span-3">
        <ChampNumerique
          id="partConventionnee"
          name="partConventionnee"
          min="0"
          max="100"
          step="5"
          quoi="la part conventionnée"
          aria-describedby="part-conventionnee-aide"
          placeholder="100"
          value={activite.partConventionnee === undefined ? "" : Math.round(activite.partConventionnee * 100)}
          onChange={e => {
            const valeur = Number.parseFloat(e.target.value)
            onChange({ ...activite, partConventionnee: Number.isFinite(valeur) ? Math.min(100, Math.max(0, valeur)) / 100 : undefined })
          }}
        />
        <p id="part-conventionnee-aide" className={aide}>
          Part des recettes tirées de l'activité conventionnée, nettes de dépassements d'honoraires : l'Assurance maladie ne prend en charge la maladie et l'ASV que sur elle. 100 % par défaut.
        </p>
      </div>
    </div>
  )
}
