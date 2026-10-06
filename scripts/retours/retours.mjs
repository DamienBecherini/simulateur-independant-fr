// scripts/retours/retours.mjs

// Fonctions pures des retours des utilisateurs : lecture d'un ticket rempli avec le formulaire
// .github/ISSUE_TEMPLATE/retour.yml, étiquettes à poser, agrégat publié avec la démo web.
// Le corps d'un ticket est une saisie non fiable : il n'est jamais exécuté ni passé à un shell,
// et seules des étiquettes de listes fixes en sortent.

/** Choix de la note, dans l'ordre du formulaire. L'application préremplit le formulaire avec ces textes exacts. */
export const OPTIONS_NOTE = ["★★★★★ 5/5", "★★★★☆ 4/5", "★★★☆☆ 3/5", "★★☆☆☆ 2/5", "★☆☆☆☆ 1/5", "Sans note"]

/** Choix de l'affichage préféré, dans l'ordre du formulaire. */
export const OPTIONS_AFFICHAGE = ["Résumé", "Classique", "Trois vues", "Sans préférence"]

/** Choix du type de retour, dans l'ordre du formulaire. */
export const OPTIONS_TYPE = ["Avis", "Bug", "Idée"]

/** Titres des sections du ticket (libellés des champs du formulaire), par champ lu. */
export const TITRES = {
  note: "Note",
  affichage: "Affichage préféré",
  type: "Type de retour"
}

/** Étiquette posée sur tous les retours. */
export const ETIQUETTE_RETOUR = "retour"

/** Étiquettes de chaque famille : une seule par famille sur un ticket. */
export const FAMILLES = {
  note: ["note-1", "note-2", "note-3", "note-4", "note-5"],
  affichage: ["affichage-resume", "affichage-classique", "affichage-vues"],
  type: ["avis", "bug", "idee"]
}

/** Couleur et description de chaque étiquette, pour les créer si elles manquent. */
export const DEFINITIONS_ETIQUETTES = {
  [ETIQUETTE_RETOUR]: { couleur: "0e8a16", description: "Retour d'un utilisateur (formulaire)" },
  "note-1": { couleur: "d73a4a", description: "Note de 1/5" },
  "note-2": { couleur: "e99695", description: "Note de 2/5" },
  "note-3": { couleur: "fbca04", description: "Note de 3/5" },
  "note-4": { couleur: "c2e0c6", description: "Note de 4/5" },
  "note-5": { couleur: "0e8a16", description: "Note de 5/5" },
  "affichage-resume": { couleur: "bfd4f2", description: "Affichage préféré : Résumé" },
  "affichage-classique": { couleur: "bfd4f2", description: "Affichage préféré : Classique" },
  "affichage-vues": { couleur: "bfd4f2", description: "Affichage préféré : Trois vues" },
  avis: { couleur: "5319e7", description: "Avis sur le simulateur" },
  bug: { couleur: "d73a4a", description: "Quelque chose ne fonctionne pas" },
  idee: { couleur: "a2eeef", description: "Idée ou demande d'amélioration" }
}

// Réponse vide d'un champ du formulaire, telle que GitHub l'écrit.
const SANS_REPONSE = "_No response_"

// Minuscules, sans accents ni espaces superflus, pour comparer des textes saisis.
function normaliser(texte) {
  return texte.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, " ").trim().toLowerCase()
}

/**
 * Découpe le corps d'un ticket en sections `### Titre` → valeur (texte entre ce titre et le suivant).
 * Les titres sont normalisés ; seule la première section d'un titre compte, pour qu'un message
 * contenant lui-même « ### Note » ne remplace pas la réponse du formulaire, placée avant lui.
 * @param {unknown} corps
 * @returns {Map<string, string>}
 */
export function lireSections(corps) {
  const sections = new Map()
  if (typeof corps !== "string") return sections
  let titre = null
  let lignes = []
  const fermer = () => {
    if (titre !== null && !sections.has(titre)) sections.set(titre, lignes.join("\n").trim())
  }
  for (const ligne of corps.split(/\r\n|\r|\n/)) {
    const entete = /^###\s+(.*\S)\s*$/.exec(ligne)
    if (entete) {
      fermer()
      titre = normaliser(entete[1])
      lignes = []
    } else if (titre !== null) {
      lignes.push(ligne)
    }
  }
  fermer()
  return sections
}

// Valeur d'un champ, chaîne vide s'il est sans réponse, undefined si sa section manque.
function valeurDuChamp(sections, champ) {
  const valeur = sections.get(normaliser(TITRES[champ]))
  if (valeur === undefined) return undefined
  return valeur === SANS_REPONSE ? "" : valeur
}

/**
 * Note lue dans une réponse : « ★★★★☆ 4/5 », « 4/5 » ou « 4 » ; null sinon (« Sans note », vide, texte libre).
 * @param {string} valeur
 * @returns {number | null}
 */
export function lireNote(valeur) {
  const resultat = /^(?:[★☆]{5}\s*)?([1-5])(?:\s*\/\s*5)?$/.exec(valeur.trim())
  return resultat ? Number(resultat[1]) : null
}

const AFFICHAGES = { resume: "resume", classique: "classique", "trois vues": "vues", vues: "vues" }
const TYPES = { avis: "avis", bug: "bug", idee: "idee" }

/**
 * Affichage préféré lu dans une réponse ; null pour « Sans préférence », vide ou inconnu.
 * @param {string} valeur
 * @returns {"resume" | "classique" | "vues" | null}
 */
export function lireAffichage(valeur) {
  return Object.hasOwn(AFFICHAGES, normaliser(valeur)) ? AFFICHAGES[normaliser(valeur)] : null
}

/**
 * Type de retour lu dans une réponse ; null si vide ou inconnu.
 * @param {string} valeur
 * @returns {"avis" | "bug" | "idee" | null}
 */
export function lireType(valeur) {
  return Object.hasOwn(TYPES, normaliser(valeur)) ? TYPES[normaliser(valeur)] : null
}

const LECTEURS = { note: lireNote, affichage: lireAffichage, type: lireType }

/**
 * Champs du formulaire présents dans le corps (même sans réponse).
 * @param {unknown} corps
 * @returns {Set<"note" | "affichage" | "type">}
 */
export function champsPresents(corps) {
  const sections = lireSections(corps)
  return new Set(Object.keys(TITRES).filter((champ) => valeurDuChamp(sections, champ) !== undefined))
}

/**
 * Réponses d'un ticket : note de 1 à 5, affichage préféré et type de retour, null quand il n'y en a pas.
 * @param {unknown} corps
 * @returns {{ note: number | null, affichage: "resume" | "classique" | "vues" | null, type: "avis" | "bug" | "idee" | null }}
 */
export function lireRetour(corps) {
  const sections = lireSections(corps)
  const lire = (champ) => {
    const valeur = valeurDuChamp(sections, champ)
    return valeur ? LECTEURS[champ](valeur) : null
  }
  return { note: lire("note"), affichage: lire("affichage"), type: lire("type") }
}

/**
 * Étiquette d'une réponse dans sa famille, null sans réponse.
 * @param {"note" | "affichage" | "type"} champ
 * @param {number | string | null} valeur
 * @returns {string | null}
 */
export function etiquetteDe(champ, valeur) {
  if (valeur === null) return null
  return champ === "type" ? valeur : `${champ}-${valeur}`
}

/**
 * Étiquettes à ajouter et à retirer pour qu'un ticket reflète ses réponses.
 * Une famille n'est touchée que si sa section figure dans le corps : un ticket écrit sans le formulaire
 * garde les étiquettes posées à la main. Une réponse effacée retire l'étiquette de sa famille.
 * @param {unknown} corps
 * @param {string[]} etiquettesActuelles
 * @returns {{ ajouter: string[], retirer: string[] }}
 */
export function calculerEtiquettes(corps, etiquettesActuelles) {
  const actuelles = new Set(etiquettesActuelles)
  const presents = champsPresents(corps)
  const retour = lireRetour(corps)
  const ajouter = []
  const retirer = []
  if (presents.size > 0 && !actuelles.has(ETIQUETTE_RETOUR)) ajouter.push(ETIQUETTE_RETOUR)
  for (const champ of presents) {
    const cible = etiquetteDe(champ, retour[champ])
    if (cible !== null && !actuelles.has(cible)) ajouter.push(cible)
    retirer.push(...FAMILLES[champ].filter((etiquette) => etiquette !== cible && actuelles.has(etiquette)))
  }
  return { ajouter, retirer }
}

// Réponse d'un champ lue sur les étiquettes, null s'il n'y en a pas une seule.
function reponseDesEtiquettes(champ, noms) {
  const trouvees = FAMILLES[champ].filter((etiquette) => noms.includes(etiquette))
  if (trouvees.length !== 1) return null
  const valeur = trouvees[0].slice(champ.length + 1)
  return champ === "note" ? Number(valeur) : valeur
}

/**
 * Note et affichage d'un ticket de `gh issue list --json body,labels` : le corps d'abord,
 * les étiquettes quand le corps n'a pas la section.
 * @param {unknown} ticket
 * @returns {{ note: number | null, affichage: string | null }}
 */
export function reponsesDuTicket(ticket) {
  const corps = typeof ticket?.body === "string" ? ticket.body : ""
  const noms = nomsDesEtiquettes(ticket)
  const presents = champsPresents(corps)
  const retour = lireRetour(corps)
  const reponse = (champ) => (presents.has(champ) ? retour[champ] : reponseDesEtiquettes(champ, noms))
  return { note: reponse("note"), affichage: reponse("affichage") }
}

/**
 * Texte court de la note, lu par le badge du README : « 4,2/5 (12 notes) » ou « pas encore de note ».
 * @param {number | null} moyenne
 * @param {number} nombreDeNotes
 * @returns {string}
 */
export function resumerNote(moyenne, nombreDeNotes) {
  if (moyenne === null || nombreDeNotes === 0) return "pas encore de note"
  const notes = nombreDeNotes === 1 ? "1 note" : `${nombreDeNotes} notes`
  return `${moyenne.toFixed(1).replace(".", ",")}/5 (${notes})`
}

/** Étiquettes posées à la main sur un ticket à ne pas compter. */
export const ETIQUETTES_ECARTEES = ["invalide", "spam"]

// Noms des étiquettes d'un ticket.
function nomsDesEtiquettes(ticket) {
  const etiquettes = Array.isArray(ticket?.labels) ? ticket.labels : []
  return etiquettes.map((etiquette) => etiquette?.name).filter((nom) => typeof nom === "string")
}

// Auteur d'un ticket ; un ticket sans auteur connu (compte supprimé) compte pour lui seul.
function auteurDe(ticket, index) {
  const login = ticket?.author?.login
  return typeof login === "string" && login !== "" ? `@${login}` : `#${index}`
}

// Date de création d'un ticket, en millisecondes ; 0 si elle manque.
function dateDe(ticket) {
  const date = Date.parse(typeof ticket?.createdAt === "string" ? ticket.createdAt : "")
  return Number.isNaN(date) ? 0 : date
}

/**
 * Une voix par compte GitHub : pour chaque auteur, la note de son ticket le plus récent qui en donne une, et de
 * même pour l'affichage préféré. Les tickets étiquetés « invalide » ou « spam » sont écartés.
 * @param {unknown} tickets tableau de `{ body, labels: [{ name }], author: { login }, createdAt }`
 * @returns {{ note: number | null, affichage: string | null }[]} une réponse par auteur
 */
export function reponsesParAuteur(tickets) {
  const liste = Array.isArray(tickets) ? tickets : []
  /** @type {Map<string, { note: number | null, affichage: string | null, dateNote: number, dateAffichage: number }>} */
  const parAuteur = new Map()
  liste.forEach((ticket, index) => {
    if (nomsDesEtiquettes(ticket).some((nom) => ETIQUETTES_ECARTEES.includes(nom))) return
    const auteur = auteurDe(ticket, index)
    const date = dateDe(ticket)
    const { note, affichage } = reponsesDuTicket(ticket)
    const actuelle = parAuteur.get(auteur) ?? { note: null, affichage: null, dateNote: -1, dateAffichage: -1 }
    if (note !== null && date >= actuelle.dateNote) Object.assign(actuelle, { note, dateNote: date })
    if (affichage !== null && date >= actuelle.dateAffichage) Object.assign(actuelle, { affichage, dateAffichage: date })
    parAuteur.set(auteur, actuelle)
  })
  return [...parAuteur.values()].map(({ note, affichage }) => ({ note, affichage }))
}

/**
 * Agrégat des retours publié dans retours.json : nombre de notes, moyenne arrondie au dixième
 * (null sans note), préférences d'affichage, résumé pour le badge et date de mise à jour.
 * Une seule voix par compte GitHub (voir reponsesParAuteur) ; les tickets sans note n'entrent pas dans la moyenne.
 * Les retours reçus par e-mail ne passent pas par les tickets et n'y entrent donc pas.
 * @param {unknown} tickets tableau de `{ body, labels: [{ name }], author: { login }, createdAt }`
 * @param {Date} [maintenant]
 */
export function agregerRetours(tickets, maintenant = new Date()) {
  const preferencesAffichage = { resume: 0, classique: 0, vues: 0 }
  let nombreDeNotes = 0
  let somme = 0
  for (const { note, affichage } of reponsesParAuteur(tickets)) {
    if (note !== null) {
      nombreDeNotes += 1
      somme += note
    }
    if (affichage !== null) preferencesAffichage[affichage] += 1
  }
  // Somme multipliée avant la division : 87 / 20 donne bien 4,4 (et non 4,3 par une erreur d'arrondi).
  const moyenne = nombreDeNotes === 0 ? null : Math.round((somme * 10) / nombreDeNotes) / 10
  return {
    nombreDeNotes,
    moyenne,
    preferencesAffichage,
    resume: resumerNote(moyenne, nombreDeNotes),
    misAJour: maintenant.toISOString()
  }
}
