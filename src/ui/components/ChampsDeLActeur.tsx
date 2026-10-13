// src/ui/components/ChampsDeLActeur.tsx
// Réglages d'un acteur hors relations : nom, parts, statut, profession, revenu fiscal de référence, date de création, capital, couleur,
// icône, frais. Affichés dans la fenêtre « Modifier », qui les enregistre à la validation.

import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { estSocieteIS, type Avatar, type Company, type Entity, type MicroEntreprise, type StatutSociete } from "@/types"
import { statutDeLActivite, type StatutDUneActivite } from "@/backend/logic/changement-de-statut"
import { availableIconsSmall } from "@/lib/avatar-constants"
import { ChampsDeplacements, ChampsFraisReels } from "./ChampsFrais"
import { ChampNumerique } from "./ChampNumerique"
import { ChampDateDeCreation, ChampHorsPlafondAnneePrecedente } from "./ChampDateDeCreation"
import { ChampProfession } from "./ChampProfession"
import { pourcent } from "@/backend/logic/format"
import type { ReglesFiscales } from "@/backend/logic/regles"
import { proposeLaProfession } from "@/lib/professions"
import { reglesDeLAnneeAffichee } from "@/lib/regles-affichees"
import { texteDuRfrN2 } from "@/lib/rfr-n2"
import { ID_DU_CHAMP_STATUT } from "./ConfirmationDuChangementDeStatut"

// Chaque pastille porte un nom : c'est lui que lit un lecteur d'écran.
const COULEURS_DES_ACTEURS = [
  { color: "#3b82f6", name: "Bleu" },
  { color: "#b91c1c", name: "Rouge" },
  { color: "#16a34a", name: "Vert" },
  { color: "#7e22ce", name: "Violet" },
  { color: "#d97706", name: "Orange" },
  { color: "#ec4899", name: "Rose" }
]

const iconNames: Record<string, string> = { Briefcase: "Mallette", Building: "Immeuble", Store: "Boutique", User: "Personne" }

/** Nom de chaque statut dans la liste « Statut » de la fiche d'une activité, dans l'ordre de « Ajouter une activité ». */
const CHOIX_DU_STATUT: Record<StatutDUneActivite, string> = {
  micro: "Micro-entreprise",
  EI: "Entreprise individuelle (au réel)",
  SASU: "SASU",
  EURL: "EURL"
}

interface ChampsDeLActeurProps {
  entity: Entity
  onChange: (entity: Entity) => void
  /** Années de la simulation : le champ du RFR N-2 nomme celles qu'il couvre. */
  anneesSimulees?: number[]
  /** L'année affichée : ses règles donnent les taux cités par les aides (profession, capital, frais). */
  annee: number
  /**
   * Un autre statut est choisi pour l'activité : il ne s'applique qu'après une confirmation qui dit ce que la conversion
   * change (ConfirmationDuChangementDeStatut), jamais comme un simple champ du brouillon.
   */
  onChangerDeStatut?: (cible: StatutDUneActivite) => void
}

export function ChampsDeLActeur({ entity, onChange, anneesSimulees = [], annee, onChangerDeStatut }: ChampsDeLActeurProps) {
  const changerAvatar = (avatar: Partial<Avatar>) => onChange({ ...entity, avatar: { ...entity.avatar, ...avatar } })

  return (
    <>
      <div className="grid grid-cols-4 items-center gap-4">
        <Label htmlFor="name" className="text-right">
          Nom
        </Label>
        <Input id="name" name="name" value={entity.name || ""} onChange={e => onChange({ ...entity, name: e.target.value })} className="col-span-3" />
      </div>
      {entity.type === "person" && (
        <div className="grid grid-cols-4 items-center gap-4">
          <Label htmlFor="fiscalParts" className="text-right">
            Parts propres
          </Label>
          <div className="col-span-3">
            <ChampNumerique id="fiscalParts" name="fiscalParts" step="0.5" quoi="les parts propres" value={entity.fiscalParts || 1} onChange={e => onChange({ ...entity, fiscalParts: Number.parseFloat(e.target.value) || 0 })} />
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">Hors enfants reliés : leurs parts s'ajoutent automatiquement. À modifier pour un cas particulier (parent isolé, invalidité…).</p>
          </div>
        </div>
      )}
      {entity.type !== "person" && <ChampDuStatut activite={entity} onChangerDeStatut={onChangerDeStatut} />}
      <StatusSpecificFields entity={entity} onChange={onChange} anneesSimulees={anneesSimulees} annee={annee} />
      <div className="grid grid-cols-4 items-center gap-4">
        <span id="avatar-couleur" className="text-right text-sm font-medium">
          Couleur
        </span>
        <div className="col-span-3 flex flex-wrap gap-2" role="group" aria-labelledby="avatar-couleur">
          {COULEURS_DES_ACTEURS.map(({ color, name }) => (
            <button type="button" key={color} aria-label={name} aria-pressed={entity.avatar.color === color} onClick={() => changerAvatar({ color })} className={`h-8 w-8 rounded-full border-2 transition-all pointer-coarse:h-11 pointer-coarse:w-11 ${entity.avatar.color === color ? "border-primary ring-2 ring-ring" : "border-transparent"}`} style={{ backgroundColor: color }} />
          ))}
        </div>
      </div>
      {entity.type !== "person" && (
        <div className="grid grid-cols-4 items-center gap-4">
          <span id="avatar-icone" className="text-right text-sm font-medium">
            Icône
          </span>
          <div className="col-span-3 flex flex-wrap gap-2" role="group" aria-labelledby="avatar-icone">
            {Object.entries(availableIconsSmall).map(([key, icon]) => (
              <button type="button" key={key} aria-label={iconNames[key] ?? key} aria-pressed={entity.avatar.value === key} onClick={() => changerAvatar({ value: key, type: "icon" })} className={`flex h-10 w-10 items-center justify-center rounded-md border-2 transition-all pointer-coarse:h-11 pointer-coarse:w-11 ${entity.avatar.value === key ? "border-primary ring-2 ring-ring bg-secondary" : "border-transparent hover:bg-secondary/80"}`}>
                {icon}
              </button>
            ))}
          </div>
        </div>
      )}
      {entity.type === "person" ? <ChampsFraisReels personne={entity} onChange={onChange} regles={reglesDeLAnneeAffichee(annee)} /> : <ChampsDeplacements activite={entity} onChange={onChange} regles={reglesDeLAnneeAffichee(annee)} />}
    </>
  )
}

/**
 * La liste « Statut » d'une activité : micro-entreprise ou statut au réel. Elle montre le statut enregistré ; en choisir
 * un autre demande la conversion de l'activité, de ses flux et de ses relations.
 */
function ChampDuStatut({ activite, onChangerDeStatut }: { activite: Company | MicroEntreprise; onChangerDeStatut?: (cible: StatutDUneActivite) => void }) {
  const actuel = statutDeLActivite(activite)
  return (
    <div className="grid grid-cols-4 items-center gap-4">
      <Label htmlFor={ID_DU_CHAMP_STATUT} className="text-right">
        Statut
      </Label>
      <div className="col-span-3">
        <Select value={actuel} onValueChange={(cible: StatutDUneActivite) => cible !== actuel && onChangerDeStatut?.(cible)}>
          <SelectTrigger id={ID_DU_CHAMP_STATUT} aria-describedby={`${ID_DU_CHAMP_STATUT}-aide`}>
            <SelectValue placeholder="Choisir un statut" />
          </SelectTrigger>
          <SelectContent>
            {(Object.keys(CHOIX_DU_STATUT) as StatutDUneActivite[]).map(statut => (
              <SelectItem key={statut} value={statut}>
                {CHOIX_DU_STATUT[statut]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p id={`${ID_DU_CHAMP_STATUT}-aide`} className="mt-1 text-sm text-slate-600 dark:text-slate-400">
          Un autre statut convertit l'activité, ses flux et ses relations ; ce qui change est dit avant de confirmer.
        </p>
      </div>
    </div>
  )
}

/** Champs propres à certains statuts : revenu fiscal de référence d'une micro-entreprise, capital et réserves d'une société à l'IS. */
function StatusSpecificFields({ entity, onChange, anneesSimulees = [], annee }: ChampsDeLActeurProps) {
  const rfr = texteDuRfrN2(anneesSimulees)
  return (
    <>
      {entity.type !== "person" && proposeLaProfession(entity) && <ChampProfession activite={entity} onChange={onChange} annee={annee} />}
      {entity.type === "micro-entreprise" && (
        <div className="grid grid-cols-4 items-center gap-4">
          <Label htmlFor="rfrN2" className="text-right">
            {rfr.libelle}
          </Label>
          <div className="col-span-3">
            <ChampNumerique
              id="rfrN2"
              name="rfrN2"
              min="0"
              step="100"
              quoi="le revenu fiscal de référence"
              placeholder="Non renseigné"
              aria-describedby="rfrN2-aide"
              value={entity.rfrN2 ?? ""}
              onChange={e => {
                const value = Number.parseFloat(e.target.value)
                onChange({ ...entity, rfrN2: Number.isFinite(value) && value >= 0 ? value : undefined })
              }}
            />
            <p id="rfrN2-aide" className="mt-1 text-sm text-slate-600 dark:text-slate-400">
              {rfr.aide}
            </p>
          </div>
        </div>
      )}
      {entity.type !== "person" && <ChampDateDeCreation activite={entity} onChange={onChange} />}
      {entity.type === "micro-entreprise" && <ChampHorsPlafondAnneePrecedente activite={entity} onChange={onChange} />}
      {entity.type === "company" && estSocieteIS(entity.legalStatus) && <ChampsDeLaSociete societe={entity} onChange={onChange} regles={reglesDeLAnneeAffichee(annee)} />}
    </>
  )
}

/**
 * Ce que le capital social change pour chaque société à l'IS, en plus de la réserve légale : rien de plus en SASU ; en
 * EURL, les dividendes au-delà d'une part du capital (règles de l'année) supportent les cotisations du gérant (voir
 * calculsEURL.ts).
 */
const AIDE_DU_CAPITAL: Record<StatutSociete, (regles: ReglesFiscales) => string> = {
  SASU: () => "",
  EURL: regles => `Les dividendes au-delà de ${pourcent(regles.EURL.seuilDividendesPartDuCapital)} du capital supportent les cotisations sociales du gérant. `
}

/**
 * Société à l'IS : son capital (réserve légale, dividendes d'EURL soumis à cotisations) et ses réserves de départ.
 * L'aide cite les parts de l'année affichée.
 */
function ChampsDeLaSociete({ societe, onChange, regles }: { societe: Company; onChange: (entity: Entity) => void; regles: ReglesFiscales }) {
  const aideCapital = estSocieteIS(societe.legalStatus) ? AIDE_DU_CAPITAL[societe.legalStatus](regles) : ""
  const reserveLegale = `${pourcent(regles.reserveLegale.partDuBenefice)} du bénéfice vont à la réserve légale, non distribuable, jusqu'à ce qu'elle atteigne ${pourcent(regles.reserveLegale.plafondPartDuCapital)} du capital.`
  return (
    <>
      <div className="grid grid-cols-4 items-center gap-4">
        <Label htmlFor="capitalSocial" className="text-right">
          Capital social
        </Label>
        <div className="col-span-3">
          <ChampNumerique id="capitalSocial" name="capitalSocial" min="0" step="100" quoi="le capital social" value={societe.capitalSocial} onChange={e => onChange({ ...societe, capitalSocial: Math.max(0, Number.parseFloat(e.target.value) || 0) })} />
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">{aideCapital}{reserveLegale}</p>
        </div>
      </div>
      <div className="grid grid-cols-4 items-center gap-4">
        <Label htmlFor="reservesInitiales" className="text-right">
          Réserves au début
        </Label>
        <div className="col-span-3">
          <ChampNumerique
            id="reservesInitiales"
            name="reservesInitiales"
            min="0"
            step="100"
            quoi="les réserves au début de la simulation"
            placeholder="Aucune"
            value={societe.reservesInitiales ?? ""}
            onChange={e => {
              const value = Number.parseFloat(e.target.value)
              onChange({ ...societe, reservesInitiales: Number.isFinite(value) && value > 0 ? value : undefined })
            }}
          />
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">Bénéfices des années d'avant la simulation gardés dans la société, réserve légale non comprise : ils pourront être distribués. Les années suivantes, la simulation les reporte elle-même.</p>
        </div>
      </div>
    </>
  )
}
