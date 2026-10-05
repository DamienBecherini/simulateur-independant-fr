// src/lib/retours.ts
// Retour d'un utilisateur (phase 13 quater, étape 1, sans serveur) : ce qu'il a répondu, le texte envoyé, et les deux
// façons de l'envoyer, un ticket GitHub prérempli par son adresse ou un e-mail prérempli. Le diagnostic, facultatif,
// ne contient jamais de donnée de la simulation : ni montant, ni nom, seulement des nombres d'années et d'acteurs.

import type { Affichage } from "@/types"
import { libelleDeLAffichage } from "./affichage"
import { ADRESSE_E_MAIL_DES_RETOURS, ADRESSE_NOUVEAU_TICKET } from "./adresses-des-retours"

export type NoteDuRetour = 1 | 2 | 3 | 4 | 5
export type TypeDeRetour = "avis" | "bug" | "idee"

/** Réponses du formulaire, toutes facultatives : `null` (ou un message vide) quand rien n'est choisi. */
export interface Retour {
  note: NoteDuRetour | null
  affichage: Affichage | null
  type: TypeDeRetour | null
  message: string
  /** Joindre le diagnostic (voir `Diagnostic`). */
  diagnostic: boolean
}

/** Informations techniques : la version et la cible sont toujours envoyées, le reste seulement avec le diagnostic. */
export interface Diagnostic {
  version: string
  /** Démo web (navigateur) ou application de bureau. */
  web: boolean
  /** Système et navigateur, tirés de l'identification du navigateur. */
  systeme: string
  navigateur: string
  affichageEnCours: Affichage
  nombreDAnnees: number
  nombreDActeurs: number
}

export const RETOUR_VIDE: Retour = { note: null, affichage: null, type: null, message: "", diagnostic: false }

export const NOTES: readonly NoteDuRetour[] = [1, 2, 3, 4, 5]

/** Libellés des types de retour, dans l'ordre du formulaire GitHub. */
export const TYPES_DE_RETOUR: readonly { valeur: TypeDeRetour; libelle: string }[] = [
  { valeur: "avis", libelle: "Avis" },
  { valeur: "bug", libelle: "Bug" },
  { valeur: "idee", libelle: "Idée" }
]

/** Choix des listes du formulaire GitHub (.github/ISSUE_TEMPLATE/retour.yml), repris mot pour mot pour le préremplir. */
export const CHOIX_DU_FORMULAIRE = {
  note: { 5: "★★★★★ 5/5", 4: "★★★★☆ 4/5", 3: "★★★☆☆ 3/5", 2: "★★☆☆☆ 2/5", 1: "★☆☆☆☆ 1/5" } satisfies Record<NoteDuRetour, string>,
  affichage: { resume: "Résumé", classique: "Classique", vues: "Trois vues" } satisfies Record<Affichage, string>,
  type: { avis: "Avis", bug: "Bug", idee: "Idée" } satisfies Record<TypeDeRetour, string>
}

/** Ce qu'il faut pour pouvoir envoyer, dit sous le bouton tant qu'il est désactivé. */
export const CONDITION_D_ENVOI = "Donnez au moins une note, un affichage préféré, un type de retour ou un message pour pouvoir envoyer."

/** Longueurs maximales des adresses : celle d'un ticket prérempli, et celle d'un lien e-mail (clients de messagerie). */
export const LONGUEUR_MAXIMALE_TICKET = 8_000
export const LONGUEUR_MAXIMALE_E_MAIL = 1_800

/** Ajouté au message coupé pour tenir dans l'adresse. */
export const NOTE_DE_TRONCATURE = "\n\n[Message tronqué : il était trop long pour être transmis en entier. La suite peut être ajoutée à la main.]"

/**
 * Le retour contient au moins une information : une note, un affichage préféré, un type de retour ou un message non
 * vide. Le diagnostic seul ne suffit pas : il ne dit rien de l'avis de l'utilisateur.
 */
export function retourEnvoyable(retour: Retour): boolean {
  return retour.note !== null || retour.affichage !== null || retour.type !== null || retour.message.trim() !== ""
}

/** « Démo web » ou « application de bureau », et, avec le diagnostic, le système et le navigateur. */
export function environnementDuRetour(retour: Retour, diagnostic: Diagnostic): string {
  const cible = diagnostic.web ? "démo web" : "application de bureau"
  return retour.diagnostic ? [cible, diagnostic.systeme, diagnostic.navigateur].join(" · ") : cible
}

/** Lignes du diagnostic joint : affichage en cours, nombres d'années et d'acteurs. Jamais de montant ni de nom. */
export function lignesDuDiagnostic(diagnostic: Diagnostic): string[] {
  return [`Affichage en cours : ${libelleDeLAffichage(diagnostic.affichageEnCours)}`, `Années simulées : ${diagnostic.nombreDAnnees}`, `Acteurs : ${diagnostic.nombreDActeurs}`]
}

/** Champs du ticket, par identifiant du formulaire GitHub ; une réponse absente n'est pas transmise. */
export function champsDuTicket(retour: Retour, diagnostic: Diagnostic): Record<string, string> {
  const champs: Record<string, string> = {}
  if (retour.note !== null) champs.note = CHOIX_DU_FORMULAIRE.note[retour.note]
  if (retour.affichage !== null) champs.affichage = CHOIX_DU_FORMULAIRE.affichage[retour.affichage]
  if (retour.type !== null) champs.type = CHOIX_DU_FORMULAIRE.type[retour.type]
  if (retour.message.trim() !== "") champs.message = retour.message.trim()
  champs.version = diagnostic.version
  champs.environnement = environnementDuRetour(retour, diagnostic)
  if (retour.diagnostic) champs.diagnostic = lignesDuDiagnostic(diagnostic).join("\n")
  return champs
}

/** Titre du ticket et sujet de l'e-mail : « [Retour] Idée · 4/5 · v0.9.0 ». */
export function titreDuRetour(retour: Retour, diagnostic: Diagnostic): string {
  const type = retour.type === null ? "Avis" : CHOIX_DU_FORMULAIRE.type[retour.type]
  return ["[Retour] " + type, ...(retour.note === null ? [] : [`${retour.note}/5`]), `v${diagnostic.version}`].join(" · ")
}

/** Sujet de l'e-mail : « Retour sur le simulateur — v0.9.0 ». */
export function sujetDeLEMail(diagnostic: Diagnostic): string {
  return `Retour sur le simulateur — v${diagnostic.version}`
}

const LIBELLES_DES_CHAMPS: Record<string, string> = {
  note: "Note",
  affichage: "Affichage préféré",
  type: "Type de retour",
  version: "Version",
  environnement: "Environnement"
}

/** Le texte du retour, tel qu'il est montré dans l'aperçu, mis dans l'e-mail et copié. */
export function texteDuRetour(retour: Retour, diagnostic: Diagnostic): string {
  const champs = champsDuTicket(retour, diagnostic)
  const lignes = ["note", "affichage", "type"].filter(cle => cle in champs).map(cle => `${LIBELLES_DES_CHAMPS[cle]} : ${champs[cle]}`)
  const blocs = [lignes.join("\n"), champs.message === undefined ? "" : `Message :\n${champs.message}`, `Version : ${champs.version}\nEnvironnement : ${champs.environnement}`, champs.diagnostic === undefined ? "" : `Diagnostic :\n${champs.diagnostic}`]
  return blocs.filter(bloc => bloc !== "").join("\n\n")
}

/** Adresse construite avec un message donné. */
type Construire = (message: string) => string

/**
 * Adresse la plus complète possible sous `longueurMaximale` : le message entier s'il tient, sinon coupé au plus long
 * qui tienne avec la note de troncature (recherche par dichotomie, sans couper un caractère en deux).
 */
function tenirDansLaLongueur(message: string, construire: Construire, longueurMaximale: number): { adresse: string; tronque: boolean } {
  const entiere = construire(message)
  if (entiere.length <= longueurMaximale || message === "") return { adresse: entiere, tronque: false }
  const caracteres = Array.from(message)
  const avec = (n: number) => construire(caracteres.slice(0, n).join("").trimEnd() + NOTE_DE_TRONCATURE)
  let bas = 0
  let haut = caracteres.length - 1
  while (bas < haut) {
    const milieu = Math.ceil((bas + haut) / 2)
    if (avec(milieu).length <= longueurMaximale) bas = milieu
    else haut = milieu - 1
  }
  return { adresse: avec(bas), tronque: true }
}

/** Adresse du ticket GitHub prérempli par le formulaire « retour.yml », sous `LONGUEUR_MAXIMALE_TICKET` caractères. */
export function adresseDuTicket(retour: Retour, diagnostic: Diagnostic): { adresse: string; tronque: boolean } {
  const champs = champsDuTicket(retour, diagnostic)
  const construire: Construire = message => {
    const parametres = new URLSearchParams({ template: "retour.yml", title: titreDuRetour(retour, diagnostic), labels: "retour" })
    for (const [cle, valeur] of Object.entries({ ...champs, ...(message === "" ? {} : { message }) })) parametres.set(cle, valeur)
    // URLSearchParams code les espaces en « + », que GitHub relit bien ; « %20 » reste plus sûr pour tous les champs.
    return `${ADRESSE_NOUVEAU_TICKET}?${parametres.toString().replace(/\+/g, "%20")}`
  }
  return tenirDansLaLongueur(champs.message ?? "", construire, LONGUEUR_MAXIMALE_TICKET)
}

/** Code une valeur de lien `mailto:` (RFC 6068) : espaces en « %20 », retours à la ligne en « %0D%0A ». */
function coderPourMailto(texte: string): string {
  return encodeURIComponent(texte.replace(/\r?\n/g, "\r\n"))
}

/** Lien `mailto:` vers l'adresse des retours, sujet et corps préremplis, sous `LONGUEUR_MAXIMALE_E_MAIL` caractères. */
export function adresseDeLEMail(retour: Retour, diagnostic: Diagnostic): { adresse: string; tronque: boolean } {
  const message = retour.message.trim()
  const construire: Construire = texte => `mailto:${ADRESSE_E_MAIL_DES_RETOURS}?subject=${coderPourMailto(sujetDeLEMail(diagnostic))}&body=${coderPourMailto(texteDuRetour({ ...retour, message: texte }, diagnostic))}`
  return tenirDansLaLongueur(message, construire, LONGUEUR_MAXIMALE_E_MAIL)
}

/** Message à coller dans une messagerie, objet en tête ; l'adresse du destinataire se copie à part. */
export function texteACopier(retour: Retour, diagnostic: Diagnostic): string {
  return `Sujet : ${sujetDeLEMail(diagnostic)}\n\n${texteDuRetour(retour, diagnostic)}`
}

/** Système et navigateur, lus dans l'identification du navigateur (`navigator.userAgent`), sans version de système. */
export function systemeEtNavigateur(userAgent: string): { systeme: string; navigateur: string } {
  const systemes: [RegExp, string][] = [
    [/Android/, "Android"],
    [/iPhone|iPad|iPod/, "iOS"],
    [/Windows/, "Windows"],
    [/Mac OS X|Macintosh/, "macOS"],
    [/CrOS/, "ChromeOS"],
    [/Linux/, "Linux"]
  ]
  // L'ordre compte : Edge et Opera se disent aussi Chrome, Chrome se dit aussi Safari.
  const navigateurs: [RegExp, string][] = [
    [/Electron\/(\d+)/, "Electron"],
    [/Edg\/(\d+)/, "Edge"],
    [/OPR\/(\d+)/, "Opera"],
    [/Firefox\/(\d+)/, "Firefox"],
    [/Chrome\/(\d+)/, "Chrome"],
    [/Version\/(\d+).*Safari/, "Safari"]
  ]
  const systeme = systemes.find(([motif]) => motif.test(userAgent))?.[1] ?? "système inconnu"
  for (const [motif, nom] of navigateurs) {
    const trouve = motif.exec(userAgent)
    if (trouve) return { systeme, navigateur: `${nom} ${trouve[1]}` }
  }
  return { systeme, navigateur: "navigateur inconnu" }
}
