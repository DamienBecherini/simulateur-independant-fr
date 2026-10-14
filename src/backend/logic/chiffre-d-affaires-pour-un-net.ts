// src/backend/logic/chiffre-d-affaires-pour-un-net.ts

import { estSocieteIS, type ChiffreDAffairesDUnStatut, type ChiffreDAffairesPourUnNet, type ComparaisonOptions, type DonneesDeLAnnee, type FinancialFlow, type RaisonHorsDePortee, type ScenarioStatut, type StatutCompare } from "../../types.js"
import { estTelleQueSaisie, libelleDeLaColonne, type ColonneEtudiee } from "./colonne-du-comparateur.js"
import { avertissementsDeLActivite, chiffreDAffaires, colonneDuComparateur, colonneDuStatut, statutsDeLaComparaison, TYPES_DE_CHIFFRE_D_AFFAIRES } from "./comparateur.js"
import { estMicro, type Activite } from "./conversion-de-statut.js"
import { CHIFFRE_D_AFFAIRES_MAXIMAL, CHIFFRE_D_AFFAIRES_REPARTI } from "./options-du-comparateur.js"
import { professionDe } from "./professions.js"
import type { ReglesFiscales } from "./regles.js"
import type { ContexteDeLAnnee } from "./simulation-engine.js"

/*
 * Calcul à l'envers du comparateur : « quel chiffre d'affaires faut-il pour toucher X € nets par an ? ». Pour chaque
 * colonne du comparateur, on cherche le chiffre d'affaires annuel de l'activité comparée qui donne ce net du foyer,
 * en simulant la colonne exactement comme le comparateur (`colonneDuStatut`) à chaque chiffre d'affaires essayé :
 * aucune formule à part, le moteur seul dit le net.
 *
 * Seul le chiffre d'affaires de l'activité change : celui de la grille est mis à l'échelle, chaque flux (mois et
 * nature : BNC, BIC, vente, prestations) gardant sa part du total ; sans chiffre d'affaires saisi, il est réparti
 * également sur les mois, en prestations de services. Tout le reste ne bouge pas : charges, autres revenus, conjoint,
 * réglages du comparateur, héritage des années précédentes.
 *
 * Recherche : le net à 0 € d'abord (déjà atteint grâce aux autres revenus du foyer : 0 €), puis des paliers doublés
 * depuis 1 000 € jusqu'au premier qui atteint le net visé, enfin un resserrement entre ce palier et le précédent
 * (fausse position, variante « Illinois », avec une dichotomie de secours), jusqu'à l'euro. Le résultat atteint le
 * net visé, et un euro de moins ne l'atteint pas.
 *
 * Le net ne monte pas toujours avec le chiffre d'affaires : fin de l'ACRE, seuils de cotisations, décote, tranches.
 * Les paliers partant du bas, on retient le plus petit palier qui atteint le net, puis un passage du net visé entre
 * ce palier et le précédent. Un chiffre d'affaires plus petit, isolé entre deux paliers essayés (un net qui atteindrait
 * le visé puis redescendrait sous lui), pourrait l'atteindre aussi : la recherche ne le garantit pas, l'interface le dit.
 *
 * Hors de portée, la colonne le dit au lieu de donner un chiffre faux : micro-entreprise au-delà de ses plafonds ou
 * régime micro fermé, société dont la grille fixe la rémunération et les dividendes, ou net jamais atteint sous
 * `CHIFFRE_D_AFFAIRES_MAXIMAL`.
 */

/** Premier palier essayé, doublé jusqu'à atteindre le net visé. */
const PREMIER_PALIER = 1000

/** Garde-fou : simulations d'une colonne au plus (une quarantaine suffisent au pire : 15 paliers, 24 dichotomies). */
const ESSAIS_MAXIMUM = 80

/**
 * Nature du chiffre d'affaires créé quand aucun n'est saisi : des prestations de services, en BNC pour une
 * micro-entreprise (la part BNC des prestations proposée par défaut au comparateur, et celle d'une profession libérale).
 */
function typeParDefaut(source: Activite): FinancialFlow["type"] {
  return source.type === "micro-entreprise" ? "ca_micro_services_bnc" : "ca_services"
}

/**
 * Les données de l'année avec ce chiffre d'affaires annuel pour l'activité : celui de la grille mis à l'échelle (mêmes
 * mois, mêmes natures), ou, sans chiffre d'affaires saisi, réparti également sur les mois. Rien d'autre ne change.
 */
export function avecUnChiffreDAffaires(donnees: DonneesDeLAnnee, source: Activite, montant: number): DonneesDeLAnnee {
  const estDuChiffreDAffaires = (flux: FinancialFlow) => flux.entityId === source.id && TYPES_DE_CHIFFRE_D_AFFAIRES.has(flux.type)
  const saisi = chiffreDAffaires(donnees, source.id)
  if (saisi > 0) {
    const facteur = montant / saisi
    return { ...donnees, monthlyData: donnees.monthlyData.map(mois => ({ ...mois, flows: mois.flows.map(flux => (estDuChiffreDAffaires(flux) ? { ...flux, amount: flux.amount * facteur } : flux)) })) }
  }
  const parMois = montant / donnees.monthlyData.length
  const type = typeParDefaut(source)
  return {
    ...donnees,
    monthlyData: donnees.monthlyData.map(mois => ({
      ...mois,
      flows: [...mois.flows.filter(flux => !estDuChiffreDAffaires(flux)), { id: `calcul-a-l-envers-${source.id}-${mois.month}`, label: "Chiffre d'affaires (calcul à l'envers)", amount: parMois, entityId: source.id, type }]
    }))
  }
}

/** Un chiffre d'affaires essayé et l'écart de son net avec le net visé (positif ou nul : atteint). */
interface Essai {
  chiffreDAffaires: number
  scenario: ScenarioStatut
  ecart: number
}

/** Ce que la recherche d'une colonne trouve : un essai qui atteint le net visé, ou pourquoi il est hors de portée. */
type Trouve = { essai: Essai } | { horsDePortee: RaisonHorsDePortee }

/** La colonne simulée à chaque chiffre d'affaires essayé, avec le nombre d'essais (garde-fou). */
function essayeur(colonne: ColonneEtudiee, statut: StatutCompare, netVise: number) {
  let essais = 0
  const essayer = (montant: number): Essai => {
    essais++
    const { scenario } = colonneDuStatut({ ...colonne, donnees: avecUnChiffreDAffaires(colonne.donnees, colonne.source, montant) }, statut)
    return { chiffreDAffaires: montant, scenario, ecart: scenario.netApresImpots - netVise }
  }
  return { essayer, epuise: () => essais >= ESSAIS_MAXIMUM }
}

/** Micro-entreprise au-delà de ses plafonds à ce chiffre d'affaires. */
const auDelaDuPlafond = (statut: StatutCompare, essai: Essai) => estMicro(statut) && essai.scenario.horsPlafond

/**
 * Paliers doublés depuis `PREMIER_PALIER` jusqu'au premier qui atteint le net visé : l'encadrement du résultat entre
 * ce palier et le précédent. Une micro-entreprise qui dépasse ses plafonds avant le net visé s'arrête là.
 */
function encadrer(statut: StatutCompare, zero: Essai, essayer: (montant: number) => Essai): { bas: Essai; haut: Essai } | { horsDePortee: RaisonHorsDePortee } {
  let bas = zero
  let haut = essayer(PREMIER_PALIER)
  while (haut.ecart < 0) {
    if (auDelaDuPlafond(statut, haut)) return { horsDePortee: "plafondMicro" }
    if (haut.chiffreDAffaires >= CHIFFRE_D_AFFAIRES_MAXIMAL) return { horsDePortee: "auDelaDeLaBorne" }
    bas = haut
    haut = essayer(Math.min(CHIFFRE_D_AFFAIRES_MAXIMAL, haut.chiffreDAffaires * 2))
  }
  return { bas, haut }
}

/** Point de fausse position entre les deux bornes, ramené à un euro strictement entre elles. */
function faussePosition(bas: number, haut: number, ecartBas: number, ecartHaut: number): number {
  const point = Math.round(bas + ((haut - bas) * -ecartBas) / (ecartHaut - ecartBas))
  return Math.min(haut - 1, Math.max(bas + 1, point))
}

/**
 * Resserre l'encadrement jusqu'à l'euro : `bas` n'atteint pas le net visé, `haut` l'atteint. Fausse position
 * « Illinois » (quand la même borne bouge deux fois de suite, le poids de l'autre est divisé par deux), et une
 * dichotomie quand deux pas n'ont pas réduit l'encadrement de moitié, si le net n'est pas assez régulier.
 */
function resserrer(encadrement: { bas: Essai; haut: Essai }, essayer: (montant: number) => Essai, epuise: () => boolean): Essai {
  let { bas, haut } = encadrement
  let poidsBas = bas.ecart
  let poidsHaut = haut.ecart
  let derniereBorne: "bas" | "haut" | null = null
  const largeurs = [haut.chiffreDAffaires - bas.chiffreDAffaires]
  while (haut.chiffreDAffaires - bas.chiffreDAffaires > 1 && !epuise()) {
    const largeur = haut.chiffreDAffaires - bas.chiffreDAffaires
    const lente = largeurs.length >= 3 && largeur > largeurs[largeurs.length - 3] / 2
    const montant = lente ? Math.floor((bas.chiffreDAffaires + haut.chiffreDAffaires) / 2) : faussePosition(bas.chiffreDAffaires, haut.chiffreDAffaires, poidsBas, poidsHaut)
    const essai = essayer(montant)
    if (essai.ecart >= 0) {
      haut = essai
      poidsHaut = essai.ecart
      if (derniereBorne === "haut") poidsBas /= 2
      derniereBorne = "haut"
    } else {
      bas = essai
      poidsBas = essai.ecart
      if (derniereBorne === "bas") poidsHaut /= 2
      derniereBorne = "bas"
    }
    largeurs.push(haut.chiffreDAffaires - bas.chiffreDAffaires)
  }
  return haut
}

/** Ce qui rend une colonne hors de portée avant toute recherche ; `null` si on peut chercher. */
function horsDePorteeDEmblee(colonne: ColonneEtudiee, statut: StatutCompare): RaisonHorsDePortee | null {
  if (estMicro(statut) && colonne.contexte.regimeMicro?.sorties[colonne.source.id]) return "regimeMicroFerme"
  // La grille fixe la rémunération et les dividendes : le chiffre d'affaires ne change que ce que la société garde.
  if (estSocieteIS(statut) && colonne.options.repartition.mode === "grille") return "partageSelonLaGrille"
  // Le portage salarial ne facture que des prestations : une activité qui ne vend que des marchandises n'y gagne rien.
  if (statut === "portage" && chiffreDAffaires(colonne.donnees, colonne.source.id) > 0 && !aDesPrestations(colonne)) return "portageSansPrestations"
  return null
}

const TYPES_DE_PRESTATIONS: ReadonlySet<FinancialFlow["type"]> = new Set<FinancialFlow["type"]>(["ca_services", "ca_micro_services_bic", "ca_micro_services_bnc"])

/** L'activité a-t-elle des prestations de services dans la grille de l'année ? */
function aDesPrestations({ donnees, source }: ColonneEtudiee): boolean {
  return donnees.monthlyData.some(mois => mois.flows.some(f => f.entityId === source.id && TYPES_DE_PRESTATIONS.has(f.type) && f.amount > 0))
}

/** Le chiffre d'affaires d'une colonne qui donne le net visé, ou pourquoi il est hors de portée. */
function chercher(colonne: ColonneEtudiee, statut: StatutCompare, netVise: number): Trouve {
  const raison = horsDePorteeDEmblee(colonne, statut)
  if (raison) return { horsDePortee: raison }
  const { essayer, epuise } = essayeur(colonne, statut, netVise)
  const zero = essayer(0)
  if (zero.ecart >= 0) return { essai: zero }
  const encadrement = encadrer(statut, zero, essayer)
  if ("horsDePortee" in encadrement) return encadrement
  const essai = resserrer(encadrement, essayer, epuise)
  return auDelaDuPlafond(statut, essai) ? { horsDePortee: "plafondMicro" } : { essai }
}

function colonneALEnvers(colonne: ColonneEtudiee, statut: StatutCompare, netVise: number): ChiffreDAffairesDUnStatut {
  const { source, options } = colonne
  const entete = { statut, libelle: libelleDeLaColonne(statut, source, options), telleQueSaisie: estTelleQueSaisie(statut, source, options) }
  const trouve = chercher(colonne, statut, netVise)
  if ("horsDePortee" in trouve) return { ...entete, chiffreDAffaires: null, netApresImpots: null, horsDePortee: trouve.horsDePortee }
  return { ...entete, chiffreDAffaires: trouve.essai.chiffreDAffaires, netApresImpots: trouve.essai.scenario.netApresImpots }
}

/**
 * Pour un net du foyer visé, le chiffre d'affaires annuel de l'activité des réglages qui le donne dans chaque colonne du
 * comparateur, avec les mêmes réglages et les mêmes statuts (sans micro-entreprise pour une profession qui l'interdit).
 */
export function chiffreDAffairesPourUnNet(donnees: DonneesDeLAnnee, optionsSaisies: ComparaisonOptions, netVise: number, regles: ReglesFiscales, contexte: ContexteDeLAnnee = {}): ChiffreDAffairesPourUnNet {
  const etudiee = colonneDuComparateur(donnees, optionsSaisies, regles, contexte)
  if (!etudiee) return { netVise, chiffreDAffairesSaisi: 0, colonnes: [], warnings: ["Choisissez une activité à comparer."] }
  const { colonne } = etudiee
  const profession = professionDe(colonne.source, regles)
  const saisi = chiffreDAffaires(donnees, colonne.source.id)
  return {
    netVise,
    chiffreDAffairesSaisi: Math.round(Math.max(0, saisi)),
    colonnes: statutsDeLaComparaison(profession).map(statut => colonneALEnvers(colonne, statut, netVise)),
    warnings: [...avertissementsDeLActivite(donnees, colonne.source, profession), ...(saisi > 0 ? [] : [CHIFFRE_D_AFFAIRES_REPARTI])]
  }
}
