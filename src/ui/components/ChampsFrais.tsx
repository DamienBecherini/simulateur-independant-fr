// src/ui/components/ChampsFrais.tsx

import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { PUISSANCES_FISCALES, type Company, type DeplacementsProfessionnels, type FraisReels, type MicroEntreprise, type Person, type PuissanceFiscale } from "@/types"

/*
 * Champs de la fenêtre de réglages d'un acteur pour les frais au barème kilométrique : frais réels d'une personne sur
 * ses salaires, déplacements professionnels d'une activité. Communs à toutes les années de la session, comme les acteurs.
 */

const LIBELLES_PUISSANCE: Record<PuissanceFiscale, string> = { "3": "3 CV et moins", "4": "4 CV", "5": "5 CV", "6": "6 CV", "7": "7 CV et plus" }

const aide = "text-sm text-slate-600 dark:text-slate-400"
const interrupteur = "flex items-center gap-2 text-sm pointer-coarse:min-h-11"

/** Nombre positif saisi dans un champ, 0 s'il est vide ou invalide, plafonné si besoin. */
function positif(valeur: string, maximum = Infinity): number {
  const nombre = parseFloat(valeur)
  return Number.isFinite(nombre) ? Math.min(maximum, Math.max(0, nombre)) : 0
}

/** Champ numérique positif. Pas de pas imposé (`step="any"`) : 12,5 km ou 305 € ne doivent pas bloquer l'enregistrement. */
function ChampNombre({ id, label, value, onChange, max }: { id: string; label: string; value: number; onChange: (valeur: number) => void; max?: number }) {
  return (
    <div className="space-y-1">
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} name={id} type="number" min="0" max={max} step="any" value={value} onChange={e => onChange(positif(e.target.value, max))} />
    </div>
  )
}

/** Puissance fiscale et motorisation électrique d'une voiture. */
function ChampsVehicule<T extends { puissanceFiscale: PuissanceFiscale; electrique: boolean }>({ prefixe, valeur, onChange }: { prefixe: string; valeur: T; onChange: (valeur: T) => void }) {
  return (
    <>
      <div className="space-y-1">
        <Label htmlFor={`${prefixe}-puissance`}>Puissance fiscale</Label>
        <Select value={valeur.puissanceFiscale} onValueChange={(puissanceFiscale: PuissanceFiscale) => onChange({ ...valeur, puissanceFiscale })}>
          <SelectTrigger id={`${prefixe}-puissance`}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PUISSANCES_FISCALES.map(cv => (
              <SelectItem key={cv} value={cv}>
                {LIBELLES_PUISSANCE[cv]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <label className={`${interrupteur} sm:col-span-2`}>
        <Switch checked={valeur.electrique} onCheckedChange={electrique => onChange({ ...valeur, electrique })} />
        Voiture électrique (+ 20 %)
      </label>
    </>
  )
}

const FRAIS_REELS_PAR_DEFAUT: FraisReels = { kmParTrajet: 0, joursTravailles: 218, puissanceFiscale: "5", electrique: false, distanceJustifiee: false, autresFrais: 0 }

/** Frais réels d'une personne : trajets domicile-travail et autres frais, comparés à la déduction de 10 %. */
export function ChampsFraisReels({ personne, onChange }: { personne: Person; onChange: (personne: Person) => void }) {
  const frais = personne.fraisReels
  const modifier = (changement: Partial<FraisReels>) => onChange({ ...personne, fraisReels: { ...(frais ?? FRAIS_REELS_PAR_DEFAUT), ...changement } })

  return (
    <div className="space-y-3 border-t pt-4">
      <h3 className="text-base font-semibold">Frais réels sur les salaires</h3>
      <label className={interrupteur}>
        <Switch checked={frais !== undefined} onCheckedChange={actif => onChange({ ...personne, fraisReels: actif ? FRAIS_REELS_PAR_DEFAUT : undefined })} />
        Comparer mes frais réels à la déduction de 10 %
      </label>
      <p className={aide}>Sur les salaires, allocations chômage et rémunérations de dirigeant, le simulateur retient le plus favorable : la déduction forfaitaire de 10 % ou vos frais réels. Réglage commun à toutes les années.</p>
      {frais ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <ChampNombre id="fraisReels-km" label="Trajet (km, aller simple)" value={frais.kmParTrajet} onChange={kmParTrajet => modifier({ kmParTrajet })} />
          <ChampNombre id="fraisReels-jours" label="Jours travaillés par an" value={frais.joursTravailles} max={366} onChange={joursTravailles => modifier({ joursTravailles })} />
          <ChampsVehicule prefixe="fraisReels" valeur={frais} onChange={vehicule => modifier(vehicule)} />
          <label className={`${interrupteur} sm:col-span-2`}>
            <Switch checked={frais.distanceJustifiee} onCheckedChange={distanceJustifiee => modifier({ distanceJustifiee })} />
            Distance justifiée au-delà de 40 km
          </label>
          <p className={`${aide} sm:col-span-2`}>Un aller-retour par jour, au barème kilométrique de l'année. Au-delà de 40 km par trajet, seuls 40 km comptent, sauf circonstances particulières justifiées (emploi précaire, emploi du conjoint, santé…).</p>
          <ChampNombre id="fraisReels-autres" label="Autres frais réels (€ par an)" value={frais.autresFrais} onChange={autresFrais => modifier({ autresFrais })} />
        </div>
      ) : null}
    </div>
  )
}

const DEPLACEMENTS_PAR_DEFAUT: DeplacementsProfessionnels = { kmParAn: 0, puissanceFiscale: "5", electrique: false }

/** Ce que deviennent les déplacements dans le statut de l'activité. */
function aideDeplacements(activite: Company | MicroEntreprise): string {
  if (activite.type === "micro-entreprise") return "En micro-entreprise, ils sont payés mais jamais déductibles : l'abattement forfaitaire couvre déjà les frais."
  if (activite.legalStatus === "EI") return "En entreprise individuelle, une charge déductible : c'est l'option du barème des BNC ; en BIC, le barème approche les frais réels de la voiture."
  return "Indemnités kilométriques remboursées au dirigeant : charge déductible de la société, ni imposées ni soumises à cotisations pour lui."
}

/** Déplacements professionnels d'une activité avec une voiture personnelle, convertis au barème kilométrique. */
export function ChampsDeplacements<T extends Company | MicroEntreprise>({ activite, onChange }: { activite: T; onChange: (activite: T) => void }) {
  const deplacements = activite.deplacementsProfessionnels
  const modifier = (changement: Partial<DeplacementsProfessionnels>) => onChange({ ...activite, deplacementsProfessionnels: { ...(deplacements ?? DEPLACEMENTS_PAR_DEFAUT), ...changement } })

  return (
    <div className="space-y-3 border-t pt-4">
      <h3 className="text-base font-semibold">Déplacements professionnels</h3>
      <label className={interrupteur}>
        <Switch checked={deplacements !== undefined} onCheckedChange={actif => onChange({ ...activite, deplacementsProfessionnels: actif ? DEPLACEMENTS_PAR_DEFAUT : undefined })} />
        Déplacements avec une voiture personnelle
      </label>
      <p className={aide}>Convertis au barème kilométrique de l'année simulée. {aideDeplacements(activite)} Réglage commun à toutes les années.</p>
      {deplacements ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <ChampNombre id="deplacements-km" label="Kilomètres professionnels par an" value={deplacements.kmParAn} onChange={kmParAn => modifier({ kmParAn })} />
          <ChampsVehicule prefixe="deplacements" valeur={deplacements} onChange={vehicule => modifier(vehicule)} />
        </div>
      ) : null}
    </div>
  )
}
