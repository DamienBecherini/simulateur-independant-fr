// src/backend/logic/regles-de-structure.ts
// Qui peut tenir quel rôle dans une activité, selon sa forme (voir l'ADR 018). Une seule table, lue par tout ce qui
// touche aux relations d'une personne vers une activité :
// - la saisie (src/lib/graph-logic.ts) et les propositions des IA (outils/commun.ts), qui refusent ce qu'elle interdit ;
// - le calcul (routage-des-flux.ts), qui y lit qui dirige et qui est associé ;
// - les avertissements du calcul, pour une sauvegarde ancienne ou un fichier importé qui la contredisent ;
// - la création d'une activité et son changement de statut, qui donnent à la personne les rôles de qui exerce.
// Une règle ajoutée ici vaut donc partout ; toutes les combinaisons de relations sont vérifiées par
// src/lib/regles-de-structure.exhaustif.test.ts.
//
// Deux sortes de limites, dites dans leur raison : ce que le droit interdit (une SAS n'a qu'un président), et ce que
// le simulateur ne sait pas calculer (un gérant d'EURL non associé, assimilé salarié).

import type { Entity, Relationship, StatutJuridique } from "../../types.js"

export type Activite = Exclude<Entity, { type: "person" }>
export type GenreDeStructure = StatutJuridique | "micro-entreprise" | "portage"
export type RoleDansUneActivite = Extract<Relationship["type"], "Président" | "Gérant" | "Associé" | "Titulaire" | "Salarié">

interface RegleDeRole {
  /** Reçoit la rémunération de dirigeant d'une société, ou le revenu d'une activité exercée en son nom. */
  dirige?: true
  /** Associé de la société : reçoit sa part des dividendes et porte sa part du résultat. */
  associe?: true
  /** Nombre de personnes que ce rôle admet au plus, et pourquoi ; absent, pas de limite. */
  maximum?: { nombre: number; raison: string }
  /** Rôles qu'une même personne ne cumule pas avec celui-ci dans la même activité. */
  incompatibles?: RoleDansUneActivite[]
  /**
   * Rôle que le calcul connaît mais que la saisie ne propose pas : les salariés d'une micro-entreprise ou d'une activité en
   * portage, gardés quand l'activité vient d'un autre statut (leur coût pèse encore sur le net).
   */
  horsSaisie?: true
}

interface RegleDeStructure {
  /** Nom de la forme avec son article indéfini, pour les messages : « une SASU ». */
  nom: string
  /** Les rôles possibles, dans l'ordre où la saisie les propose. */
  roles: Partial<Record<RoleDansUneActivite, RegleDeRole>>
}

const UN_SEUL_TITULAIRE = "une activité exercée en son nom propre n'a qu'un titulaire"

/**
 * Sources : article L227-6 du Code de commerce (la SAS est représentée par un président) ; article L223-18 (la SARL est
 * gérée par une ou plusieurs personnes physiques, qui peuvent être choisies en dehors des associés) ; service-public.fr,
 * F36239 (le gérant non associé d'une EURL, rémunéré, est assimilé salarié). Voir l'ADR 018.
 */
export const REGLES_DE_STRUCTURE: Record<GenreDeStructure, RegleDeStructure> = {
  SASU: {
    nom: "une SASU",
    roles: {
      // Le président n'est pas associé d'office : il peut être un tiers. Associé, il porte aussi la relation « Associé ».
      Président: { dirige: true, maximum: { nombre: 1, raison: "une SAS n'a qu'un président (article L227-6 du Code de commerce)" }, incompatibles: ["Salarié"] },
      Associé: { associe: true },
      Salarié: { incompatibles: ["Président"] }
    }
  },
  EURL: {
    nom: "une EURL",
    roles: {
      // Le gérant est toujours associé ici : non associé, il serait assimilé salarié, ce que le simulateur ne calcule pas.
      Gérant: { dirige: true, associe: true, incompatibles: ["Salarié"] },
      Associé: { associe: true },
      Salarié: { incompatibles: ["Gérant"] }
    }
  },
  EI: {
    nom: "une entreprise individuelle",
    roles: {
      Titulaire: { dirige: true, maximum: { nombre: 1, raison: UN_SEUL_TITULAIRE }, incompatibles: ["Salarié"] },
      Salarié: { incompatibles: ["Titulaire"] }
    }
  },
  "micro-entreprise": {
    nom: "une micro-entreprise",
    // Un salarié n'y est pas proposé : son coût n'y réduit ni cotisations ni impôt. Celui d'une activité devenue
    // micro-entreprise reste, son coût réduisant encore le net encaissé.
    roles: { Titulaire: { dirige: true, maximum: { nombre: 1, raison: UN_SEUL_TITULAIRE }, incompatibles: ["Salarié"] }, Salarié: { incompatibles: ["Titulaire"], horsSaisie: true } }
  },
  portage: {
    nom: "une activité en portage salarial",
    // Le comparateur garde les salariés de l'activité dans sa colonne « Portage salarial », pour dire qu'elle n'est pas retenue.
    roles: { Titulaire: { dirige: true, maximum: { nombre: 1, raison: "une activité en portage n'a qu'un salarié porté" }, incompatibles: ["Salarié"] }, Salarié: { incompatibles: ["Titulaire"], horsSaisie: true } }
  }
}

/** La forme d'une activité : son statut juridique au réel, « micro-entreprise » ou « portage ». */
export function genreDeStructure(activite: Activite): GenreDeStructure {
  return activite.type === "company" ? activite.legalStatus : activite.type
}

/** Les rôles que la saisie propose pour une activité de cette forme, dans l'ordre où elle les propose. */
export function rolesDeLaStructure(genre: GenreDeStructure): RoleDansUneActivite[] {
  const { roles } = REGLES_DE_STRUCTURE[genre]
  return (Object.keys(roles) as RoleDansUneActivite[]).filter(role => !roles[role]?.horsSaisie)
}

/** Le nombre de personnes que ce rôle admet au plus dans cette forme ; `undefined` sans limite. */
export function maximumDuRole(genre: GenreDeStructure, role: Relationship["type"]): number | undefined {
  return REGLES_DE_STRUCTURE[genre].roles[role as RoleDansUneActivite]?.maximum?.nombre
}

/** Les rôles de cette forme qui font diriger l'activité, ou en être associé. */
export function rolesQui(genre: GenreDeStructure, qualite: "dirige" | "associe"): RoleDansUneActivite[] {
  return rolesDeLaStructure(genre).filter(role => REGLES_DE_STRUCTURE[genre].roles[role]?.[qualite] === true)
}

/**
 * Les personnes qui dirigent l'activité, ou qui en sont associées, selon les rôles de sa forme : sans doublon, dans
 * l'ordre des relations. Le calcul verse la rémunération au premier dirigeant et partage les dividendes entre les
 * associés (routage-des-flux.ts) ; la grille montre sur la ligne de chacun ce qu'il reçoit (grille-mensuelle.ts).
 */
export function personnesQui(session: { entities: Pick<Entity, "id" | "type">[]; relationships: Relations }, activite: Activite, qualite: "dirige" | "associe"): string[] {
  const roles: Relationship["type"][] = rolesQui(genreDeStructure(activite), qualite)
  const ids = new Set<string>()
  for (const rel of session.relationships) {
    if (!roles.includes(rel.type) || (rel.fromId !== activite.id && rel.toId !== activite.id)) continue
    const autre = rel.fromId === activite.id ? rel.toId : rel.fromId
    if (session.entities.some(e => e.id === autre && e.type === "person")) ids.add(autre)
  }
  return [...ids]
}

/**
 * Les rôles de la personne qui exerce seule une activité de cette forme, donnés à sa création et à son changement de
 * statut : elle la dirige et, en société, en est l'associée. Le président d'une SASU reçoit donc aussi « Associé ».
 */
export function rolesDeQuiExerce(genre: GenreDeStructure): RoleDansUneActivite[] {
  const [direction] = rolesQui(genre, "dirige")
  const associes = rolesQui(genre, "associe")
  return associes.length === 0 || associes.includes(direction) ? [direction] : [direction, associes[0]]
}

export type Relations = Pick<Relationship, "fromId" | "toId" | "type">[]

/** Les personnes reliées à l'activité par ce rôle, sans doublon, dans l'ordre des relations. */
function tenantsDuRole(relations: Relations, activiteId: string, role: Relationship["type"]): string[] {
  const tenants = relations.filter(rel => rel.type === role && (rel.fromId === activiteId || rel.toId === activiteId)).map(rel => (rel.fromId === activiteId ? rel.toId : rel.fromId))
  return [...new Set(tenants)]
}

/** Les rôles que cette personne tient déjà dans l'activité. */
function rolesDeLaPersonne(relations: Relations, activiteId: string, personneId: string): Relationship["type"][] {
  return relations.filter(rel => (rel.fromId === personneId && rel.toId === activiteId) || (rel.fromId === activiteId && rel.toId === personneId)).map(rel => rel.type)
}

/** Le titulaire d'une activité exercée en nom propre : la première personne reliée par « Titulaire », celle que le calcul retient. */
function titulaireDe(relations: Relations, activiteId: string): string | undefined {
  return tenantsDuRole(relations, activiteId, "Titulaire")[0]
}

/** Le strict nécessaire d'une activité pour savoir si elle est exercée en nom propre. */
interface FormeDeLActivite {
  id: string
  type: string
  legalStatus?: string
}

/** Une micro-entreprise ou une entreprise individuelle au réel : la personne l'exerce en son nom. Le portage n'en est pas (un salarié porté). */
const enNomPropre = (activite: FormeDeLActivite) => activite.type === "micro-entreprise" || (activite.type === "company" && activite.legalStatus === "EI")

/**
 * Les entreprises en nom propre du titulaire de celle-ci, elle comprise, dans l'ordre de la session ; elle seule si
 * elle n'a pas de titulaire ou n'est pas exercée en nom propre.
 *
 * Une personne physique n'a qu'une entreprise individuelle (un seul numéro SIREN), qui réunit toutes ses activités :
 * leurs seuils s'apprécient sur le chiffre d'affaires de l'ensemble (service-public.fr, F33339 : « un seuil global »
 * pour « l'ensemble des activités exercées par l'entreprise »). La saisie laisse pourtant créer plusieurs
 * micro-entreprises pour une même personne, façon naturelle de décrire deux activités : le calcul les réunit pour les
 * plafonds (voir `chiffreAffairesReuni`, dispositifs.ts) et le dit sur leur carte (`anomaliesDeStructure`).
 */
export function entreprisesDuTitulaire<A extends FormeDeLActivite>(session: { entities: A[]; relationships?: Relations }, activiteId: string): A[] {
  const relations = session.relationships ?? []
  const activite = session.entities.find(e => e.id === activiteId)
  if (!activite) return []
  const titulaire = enNomPropre(activite) ? titulaireDe(relations, activiteId) : undefined
  // Une relation « Titulaire » vers autre chose qu'une personne (fichier écrit à la main) ne réunit rien.
  if (titulaire === undefined || !session.entities.some(e => e.id === titulaire && e.type === "person")) return [activite]
  return session.entities.filter(e => e.id === activiteId || (enNomPropre(e) && titulaireDe(relations, e.id) === titulaire))
}

/** Ce qui s'oppose à ce qu'une personne prenne un rôle dans une activité. */
export type ObstacleAuRole =
  | { genre: "inconnu"; possibles: RoleDansUneActivite[] }
  | { genre: "cumul"; avec: RoleDansUneActivite }
  | { genre: "maximum"; tenuPar: string; raison: string }

/**
 * Ce qui s'oppose à ce que cette personne prenne ce rôle dans cette activité, d'après les relations existantes ; `null`
 * si rien ne s'y oppose. La relation déjà présente entre les deux est l'affaire de l'appelant.
 */
export function obstacleAuRole(relations: Relations, personneId: string, activite: Activite, role: Relationship["type"]): ObstacleAuRole | null {
  const genre = genreDeStructure(activite)
  const regle = REGLES_DE_STRUCTURE[genre].roles[role as RoleDansUneActivite]
  if (!regle || regle.horsSaisie) return { genre: "inconnu", possibles: rolesDeLaStructure(genre) }
  const dejaTenus = rolesDeLaPersonne(relations, activite.id, personneId)
  const cumul = regle.incompatibles?.find(incompatible => dejaTenus.includes(incompatible))
  if (cumul) return { genre: "cumul", avec: cumul }
  if (regle.maximum) {
    const autres = tenantsDuRole(relations, activite.id, role).filter(id => id !== personneId)
    if (autres.length >= regle.maximum.nombre) return { genre: "maximum", tenuPar: autres[0], raison: regle.maximum.raison }
  }
  return null
}

/** Les rôles que cette personne peut encore prendre dans cette activité. */
export function rolesDisponibles(relations: Relations, personneId: string, activite: Activite): RoleDansUneActivite[] {
  const dejaTenus = rolesDeLaPersonne(relations, activite.id, personneId)
  return rolesDeLaStructure(genreDeStructure(activite)).filter(role => !dejaTenus.includes(role) && obstacleAuRole(relations, personneId, activite, role) === null)
}

/** Le refus d'un rôle, en une phrase : pour une proposition d'IA, ou pour expliquer pourquoi la saisie ne le propose pas. */
export function phraseDeLObstacle(obstacle: ObstacleAuRole, role: Relationship["type"], personne: string, activite: Activite, nomDe: (id: string) => string): string {
  if (obstacle.genre === "inconnu") return `Relations possibles d'une personne vers « ${activite.name} » (${genreDeStructure(activite)}) : ${obstacle.possibles.join(", ")}.`
  if (obstacle.genre === "maximum") return `« ${activite.name} » a déjà un ${role.toLowerCase()}, « ${nomDe(obstacle.tenuPar)} » : ${obstacle.raison}. Supprimez d'abord cette relation pour en changer.`
  if (role === "Salarié") return `« ${personne} » dirige déjà « ${activite.name} » : pas de relation « Salarié » en plus.`
  return `« ${personne} » est déjà salarié(e) de « ${activite.name} » : pas de relation de direction en plus.`
}

const ROLES: ReadonlySet<Relationship["type"]> = new Set<Relationship["type"]>(["Président", "Gérant", "Associé", "Titulaire", "Salarié"])

/**
 * Ce qui, dans les relations d'une activité, contredit la table : un rôle que sa forme n'a pas, un rôle tenu par plus de
 * personnes qu'il n'en admet, deux rôles qu'une même personne ne cumule pas. La saisie ne laisse plus rien créer de tel,
 * mais une sauvegarde ancienne, un fichier importé ou un changement de statut peuvent en porter : le calcul le signale
 * sur la carte de l'activité, et dit ce qu'il en fait.
 */
export function anomaliesDeStructure(session: { entities: Entity[]; relationships: Relations }, activite: Activite): string[] {
  const genre = genreDeStructure(activite)
  const { nom, roles } = REGLES_DE_STRUCTURE[genre]
  const personnes = new Map(session.entities.filter(e => e.type === "person").map(e => [e.id, e.name]))
  const nomDe = (id: string) => `« ${personnes.get(id) ?? id} »`
  const anomalies: string[] = []

  for (const role of ROLES) {
    const tenants = tenantsDuRole(session.relationships, activite.id, role).filter(id => personnes.has(id))
    if (tenants.length === 0) continue
    const regle = roles[role as RoleDansUneActivite]
    if (!regle) {
      anomalies.push(`Relation « ${role} » de ${tenants.map(nomDe).join(", ")} : ce rôle n'existe pas pour ${nom}, le calcul l'ignore. Remplacez-la par l'une de celles-ci : ${rolesDeLaStructure(genre).join(", ")}.`)
      continue
    }
    if (regle.maximum && tenants.length > regle.maximum.nombre) {
      anomalies.push(`Plusieurs relations « ${role} » (${tenants.map(nomDe).join(", ")}) : ${regle.maximum.raison}. Le calcul ne retient que ${nomDe(tenants[0])} ; supprimez les autres.`)
    }
    for (const personneId of tenants) {
      const cumul = regle.incompatibles?.find(incompatible => rolesDeLaPersonne(session.relationships, activite.id, personneId).includes(incompatible))
      // Dit une fois par paire de rôles : depuis le rôle qui dirige.
      if (cumul && regle.dirige) anomalies.push(`${nomDe(personneId)} est à la fois ${role.toLowerCase()} et ${cumul.toLowerCase()} de « ${activite.name} » : on ne dirige pas l'activité dont on est salarié. Supprimez l'une des deux relations.`)
    }
  }
  return [...anomalies, ...plusieursEntreprisesEnNomPropre(session, activite, nomDe)]
}

/**
 * Le titulaire de l'activité l'est aussi d'autres entreprises en nom propre. La saisie le permet (deux activités se
 * décrivent bien par deux micro-entreprises), mais une personne n'a qu'une entreprise individuelle : la carte de
 * chacune le dit, avec ce que le calcul en fait.
 */
function plusieursEntreprisesEnNomPropre(session: { entities: Entity[]; relationships: Relations }, activite: Activite, nomDe: (id: string) => string): string[] {
  const entreprises = entreprisesDuTitulaire(session, activite.id)
  const titulaire = titulaireDe(session.relationships, activite.id)
  if (entreprises.length < 2 || titulaire === undefined) return []
  const micros = entreprises.filter(e => e.type === "micro-entreprise")
  const reunies = micros.length > 1 ? " Les plafonds du régime micro et de la franchise de TVA sont calculés sur le chiffre d'affaires réuni de ses micro-entreprises." : ""
  const aPart = micros.length < entreprises.length ? " Le régime micro de l'une et le régime réel de l'autre sont calculés côte à côte, chacun de son côté." : ""
  return [`${nomDe(titulaire)} est titulaire de plusieurs entreprises en nom propre (${entreprises.map(e => `« ${e.name} »`).join(", ")}) : une personne n'a qu'une entreprise individuelle, qui réunit toutes ses activités.${reunies}${aPart}`]
}
