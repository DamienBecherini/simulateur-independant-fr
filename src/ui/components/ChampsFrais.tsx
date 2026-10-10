// src/ui/components/ChampsFrais.tsx

import { useEffect, useRef } from "react"
import { Plus, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { estSocieteIS, PUISSANCES_FISCALES, type Company, type DeplacementsProfessionnels, type FraisReels, type MicroEntreprise, type Person, type PuissanceFiscale, type Trajet } from "@/types"
import { pourcent } from "@/backend/logic/format"
import type { ReglesFiscales } from "@/backend/logic/regles"
import { ChampNumerique } from "./ChampNumerique"

/*
 * Champs de la fenêtre de réglages d'un acteur pour les frais au barème kilométrique : frais réels d'une personne sur
 * ses salaires, déplacements professionnels d'une activité. Communs à toutes les années de la session, comme les acteurs ;
 * les taux et distances cités dans les textes sont ceux des règles de l'année affichée.
 */

const LIBELLES_PUISSANCE: Record<PuissanceFiscale, string> = { "3": "3 CV et moins", "4": "4 CV", "5": "5 CV", "6": "6 CV", "7": "7 CV et plus" }

const aide = "text-sm text-slate-600 dark:text-slate-400"
const kilometres = (km: number) => `${km.toLocaleString("fr-FR")} km`
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
      <ChampNumerique id={id} name={id} min="0" max={max} step="any" quoi={`« ${label} »`} value={value} onChange={e => onChange(positif(e.target.value, max))} />
    </div>
  )
}

/** Puissance fiscale et motorisation électrique d'une voiture, avec la majoration du barème pour une électrique. */
function ChampsVehicule<T extends { puissanceFiscale: PuissanceFiscale; electrique: boolean }>({ prefixe, valeur, onChange, majorationElectrique }: { prefixe: string; valeur: T; onChange: (valeur: T) => void; majorationElectrique: number }) {
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
        Voiture électrique (+ {pourcent(majorationElectrique)})
      </label>
    </>
  )
}

const TRAJET_PAR_DEFAUT: Trajet = { libelle: "", kmParTrajet: 0, joursTravailles: 218, puissanceFiscale: "5", electrique: false, distanceJustifiee: false }
const FRAIS_REELS_PAR_DEFAUT: FraisReels = { trajets: [TRAJET_PAR_DEFAUT], autresFrais: 0 }

/** Un trajet domicile-travail, vers l'un des lieux de travail de la personne, avec son bouton pour le retirer. */
function ChampsTrajet({ numero, trajet, onChange, onRetirer, regles }: { numero: number; trajet: Trajet; onChange: (trajet: Trajet) => void; onRetirer: () => void; regles: ReglesFiscales }) {
  const prefixe = `fraisReels-${numero}`
  const modifier = (changement: Partial<Trajet>) => onChange({ ...trajet, ...changement })

  return (
    <fieldset className="grid min-w-0 gap-3 rounded-md border p-3 sm:grid-cols-2">
      <legend className="px-1 text-sm font-medium wrap-anywhere">
        Trajet {numero}
        {trajet.libelle.trim() ? ` : ${trajet.libelle.trim()}` : ""}
      </legend>
      <div className="space-y-1 sm:col-span-2">
        <Label htmlFor={`${prefixe}-libelle`}>Lieu de travail ou employeur (facultatif)</Label>
        <Input id={`${prefixe}-libelle`} name={`${prefixe}-libelle`} value={trajet.libelle} maxLength={60} onChange={e => modifier({ libelle: e.target.value })} />
      </div>
      <ChampNombre id={`${prefixe}-km`} label="Trajet (km, aller simple)" value={trajet.kmParTrajet} onChange={kmParTrajet => modifier({ kmParTrajet })} />
      <ChampNombre id={`${prefixe}-jours`} label="Jours travaillés par an" value={trajet.joursTravailles} max={366} onChange={joursTravailles => modifier({ joursTravailles })} />
      <ChampsVehicule prefixe={prefixe} valeur={trajet} onChange={modifier} majorationElectrique={regles.baremeKilometrique.majorationElectrique} />
      <label className={`${interrupteur} sm:col-span-2`}>
        <Switch checked={trajet.distanceJustifiee} onCheckedChange={distanceJustifiee => modifier({ distanceJustifiee })} />
        Distance justifiée au-delà de {kilometres(regles.baremeKilometrique.domicileTravail.distanceMaxParTrajet)}
      </label>
      <Button type="button" variant="outline" size="sm" className="justify-self-start sm:col-span-2" aria-label={`Retirer le trajet ${numero}`} onClick={onRetirer}>
        <Trash2 aria-hidden="true" />
        Retirer
      </Button>
    </fieldset>
  )
}

/** Frais réels d'une personne : trajets domicile-travail et autres frais, comparés à la déduction forfaitaire. */
export function ChampsFraisReels({ personne, onChange, regles }: { personne: Person; onChange: (personne: Person) => void; regles: ReglesFiscales }) {
  const deduction = pourcent(regles.IR.abattementSalaires.taux)
  const distanceMax = kilometres(regles.baremeKilometrique.domicileTravail.distanceMaxParTrajet)
  const frais = personne.fraisReels
  const modifier = (changement: Partial<FraisReels>) => onChange({ ...personne, fraisReels: { ...(frais ?? FRAIS_REELS_PAR_DEFAUT), ...changement } })
  const trajets = frais?.trajets ?? []
  const boutonAjouter = useRef<HTMLButtonElement>(null)
  // Au clavier, le focus suit la liste : sur le premier champ d'un trajet ajouté, sur le bouton d'ajout après un retrait.
  const focusApres = useRef<"ajout" | "retrait" | null>(null)
  useEffect(() => {
    if (focusApres.current === "ajout") document.getElementById(`fraisReels-${trajets.length}-libelle`)?.focus()
    if (focusApres.current === "retrait") boutonAjouter.current?.focus()
    focusApres.current = null
  }, [trajets.length])

  const ajouter = () => {
    focusApres.current = "ajout"
    // Le nouveau trajet reprend la voiture du précédent : c'est le plus souvent la même.
    const precedent = trajets[trajets.length - 1]
    modifier({ trajets: [...trajets, precedent ? { ...TRAJET_PAR_DEFAUT, puissanceFiscale: precedent.puissanceFiscale, electrique: precedent.electrique } : TRAJET_PAR_DEFAUT] })
  }
  const retirer = (index: number) => {
    focusApres.current = "retrait"
    modifier({ trajets: trajets.filter((_, i) => i !== index) })
  }

  return (
    <div className="space-y-3 border-t pt-4">
      <h3 className="text-base font-semibold">Frais réels sur les salaires</h3>
      <label className={interrupteur}>
        <Switch checked={frais !== undefined} onCheckedChange={actif => onChange({ ...personne, fraisReels: actif ? FRAIS_REELS_PAR_DEFAUT : undefined })} />
        Comparer mes frais réels à la déduction de {deduction}
      </label>
      <p className={aide}>Sur les salaires, allocations chômage et rémunérations de dirigeant, le simulateur retient le plus favorable : la déduction forfaitaire de {deduction} ou vos frais réels, pour tous ces revenus à la fois. Réglage commun à toutes les années.</p>
      {frais ? (
        <>
          <p className={aide}>
            Un trajet par lieu de travail, un aller-retour par jour, au barème kilométrique de l'année. Au-delà de {distanceMax} par trajet, seuls {distanceMax} comptent, sauf circonstances particulières justifiées (emploi précaire, emploi du conjoint, santé…). Les kilomètres faits avec la même voiture (même puissance, même motorisation) s'additionnent : le barème s'applique une fois par voiture.
          </p>
          {trajets.map((trajet, index) => (
            <ChampsTrajet key={index} numero={index + 1} trajet={trajet} onChange={modifie => modifier({ trajets: trajets.map((t, i) => (i === index ? modifie : t)) })} onRetirer={() => retirer(index)} regles={regles} />
          ))}
          <Button ref={boutonAjouter} type="button" variant="outline" size="sm" onClick={ajouter}>
            <Plus aria-hidden="true" />
            Ajouter un trajet
          </Button>
          <div className="grid gap-3 sm:grid-cols-2">
            <ChampNombre id="fraisReels-autres" label="Autres frais réels (€ par an)" value={frais.autresFrais} onChange={autresFrais => modifier({ autresFrais })} />
          </div>
        </>
      ) : null}
    </div>
  )
}

const DEPLACEMENTS_PAR_DEFAUT: DeplacementsProfessionnels = { kmParAn: 0, puissanceFiscale: "5", electrique: false }

/** Ce que deviennent les déplacements dans le statut de l'activité. */
function aideDeplacements(activite: Company | MicroEntreprise): string {
  if (activite.type === "micro-entreprise") return "En micro-entreprise, ils sont payés mais jamais déductibles : l'abattement forfaitaire couvre déjà les frais."
  if (!estSocieteIS(activite.legalStatus)) return "En entreprise individuelle, une charge déductible : c'est l'option du barème des BNC ; en BIC, le barème approche les frais réels de la voiture."
  return "Indemnités kilométriques remboursées au dirigeant : charge déductible de la société, ni imposées ni soumises à cotisations pour lui."
}

/** Déplacements professionnels d'une activité avec une voiture personnelle, convertis au barème kilométrique. */
export function ChampsDeplacements<T extends Company | MicroEntreprise>({ activite, onChange, regles }: { activite: T; onChange: (activite: T) => void; regles: ReglesFiscales }) {
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
          <ChampsVehicule prefixe="deplacements" valeur={deplacements} onChange={vehicule => modifier(vehicule)} majorationElectrique={regles.baremeKilometrique.majorationElectrique} />
        </div>
      ) : null}
    </div>
  )
}
