// src/backend/donnees-de-l-application.ts
// Lecture et écriture des trois fichiers de données de l'application de bureau (session en cours, sauvegardes,
// préférences ; voir les ADR 002 et 005). Le process principal (main.ts) fournit le dossier, la version et l'affichage
// des messages : ce module ne dépend pas d'Electron et se teste sur un dossier temporaire.
//
// Règle commune : un fichier qu'on ne peut pas garder tel quel (illisible, en partie refusé ou nettoyé) est copié à côté
// sous un nom horodaté avant d'être remplacé, et l'utilisateur est prévenu ; s'il n'a pu être ni lu ni copié, il n'est
// plus jamais écrit jusqu'à la fermeture. Toute écriture est atomique, et son échec est signalé à l'interface.

import path from "node:path"
import type { NotificationPayload, SanitizationReport, SaveSlot, SessionState, UserPreferences } from "../types.js"
import { SessionStateSchema } from "../types.js"
import { AnneesRefuseesError, texteAnneesEcartees, texteProfessionsEcartees } from "./logic/data-sanitizer.js"
import { contenuDesSauvegardes, contenuDuFichier, lireLaSession, lireLesPreferences, lireLesSauvegardes, preferencesParDefaut, preferencesValides, sauvegardesAEcrire } from "./logic/fichiers-de-donnees.js"
import { FORMAT_VERSION_ACTUEL, migrerVersFormatActuel, versionDuFormat } from "./logic/migrations.js"
import { copierACote, copierSansRemplacer, ecrireAtomiquement, ecrireAtomiquementSync, jsonOuRien, lireLeFichier, type RaisonDeLaCopie } from "./fichiers-surs.js"

/** Une boîte de dialogue d'information ou d'avertissement, affichée au démarrage. */
export interface Avertissement {
  type: "info" | "warning"
  title: string
  message: string
}

export interface OptionsDesDonnees {
  /** Dossier des données de l'application. */
  dossier: string
  /** Version de l'application, écrite dans chaque fichier. */
  versionDeLApplication: string
  /** Affiche une boîte de dialogue (au chargement). */
  avertir: (avertissement: Avertissement) => void
  /** Affiche une notification dans l'interface (après une écriture). */
  notifier: (notification: NotificationPayload) => void
  /** Date des copies horodatées ; l'heure courante par défaut. */
  maintenant?: () => Date
}

export const MESSAGES = {
  sauvegardeReussie: "Sauvegarde réussie !",
  echecDesSauvegardes: "Échec de la sauvegarde : le fichier des sauvegardes n'a pas pu être écrit. Vos sauvegardes précédentes sont intactes.",
  echecDeLaSession: "Échec de la sauvegarde automatique : vos dernières modifications ne sont pas enregistrées sur le disque.",
  echecDesPreferences: "Échec de l'enregistrement des préférences (zoom, ordre des sauvegardes, affichage)."
} as const

const pluriel = (n: number, un: string, plusieurs: string) => (n > 1 ? plusieurs : un)

/** Texte des points à vérifier après conversion, pour une boîte de dialogue. */
function formatMigrationNotes(notes: string[]): string {
  return notes.map(note => `- ${note}`).join("\n\n")
}

/** Ce que le nettoyage a retiré d'une session : ce qui serait perdu à la prochaine écriture. */
function sectionDesPertes(report: SanitizationReport): string[] {
  const sections: string[] = []
  if (report.entitiesRemoved > 0 || report.relationshipsRemoved > 0 || report.flowsRemoved > 0 || report.reglagesRemoved > 0) {
    sections.push(`Des données corrompues ont dû être nettoyées :\n- Entités invalides supprimées : ${report.entitiesRemoved}\n- Relations invalides ou orphelines supprimées : ${report.relationshipsRemoved}\n- Flux invalides ou orphelins supprimés : ${report.flowsRemoved}\n- Réglages du comparateur invalides écartés : ${report.reglagesRemoved}`)
  }
  if (report.professionsRemoved > 0) sections.push(texteProfessionsEcartees(report.professionsRemoved))
  if (report.anneesEcartees.length > 0) sections.push(`${texteAnneesEcartees(report.anneesEcartees)}. Seule la première occurrence de chaque année a été gardée.`)
  return sections
}

/** Une notification d'échec n'est montrée qu'une fois, jusqu'à la prochaine écriture réussie (sauvegarde automatique). */
function signalementUnique(notifier: (notification: NotificationPayload) => void, message: string) {
  let dejaSignale = false
  return {
    reussite: () => {
      dejaSignale = false
    },
    echec: () => {
      if (!dejaSignale) notifier({ message, type: "error" })
      dejaSignale = true
    }
  }
}

export function donneesDeLApplication({ dossier, versionDeLApplication, avertir, notifier, maintenant = () => new Date() }: OptionsDesDonnees) {
  const cheminDeLaSession = path.join(dossier, "sessionState.json")
  const cheminDesSauvegardes = path.join(dossier, "simulationSlots.json")
  const cheminDesPreferences = path.join(dossier, "userPreferences.json")

  const echecDeLaSession = signalementUnique(notifier, MESSAGES.echecDeLaSession)
  const echecDesPreferences = signalementUnique(notifier, MESSAGES.echecDesPreferences)

  /** Copie horodatée d'un fichier ; la phrase qui la désigne, ou qui dit qu'il est protégé faute de copie. */
  async function garderUneCopie(chemin: string, raison: RaisonDeLaCopie, deplacer = false): Promise<{ copie: boolean; phrase: string }> {
    const copie = await copierACote(chemin, raison, { maintenant: maintenant(), deplacer })
    if (copie !== null) return { copie: true, phrase: `Une copie du fichier a été gardée à côté de lui : ${path.basename(copie)}\n(dans ${dossier}).` }
    return { copie: false, phrase: `Le fichier n'a pas pu être copié : il ne sera pas modifié tant que l'application reste ouverte. Fermez-la et copiez-le ailleurs avant de la relancer :\n${chemin}` }
  }

  /**
   * Avant de réécrire un fichier converti d'un format précédent, on en garde une copie à côté
   * (`sessionState.format-1.json`) ; une copie existante est conservée.
   */
  const copieAvantConversion = (chemin: string, version: number) => copierSansRemplacer(chemin, `format-${version}`)

  // --- Session en cours ---

  /** Écrit la session ; `false` si l'écriture a échoué (l'interface en est prévenue, une fois). */
  async function ecrireLaSession(session: SessionState): Promise<boolean> {
    try {
      await ecrireAtomiquement(cheminDeLaSession, contenuDuFichier(session, versionDeLApplication))
      echecDeLaSession.reussite()
      return true
    } catch (error) {
      console.error("Erreur lors de la sauvegarde de la session :", error)
      echecDeLaSession.echec()
      return false
    }
  }

  /** Écrit la session tout de suite, de façon synchrone (fermeture de la fenêtre) ; `false` si l'écriture a échoué. */
  function ecrireLaSessionSync(session: SessionState): boolean {
    try {
      ecrireAtomiquementSync(cheminDeLaSession, contenuDuFichier(session, versionDeLApplication))
      return true
    } catch (error) {
      console.error("Erreur lors de la sauvegarde de la session à la fermeture :", error)
      return false
    }
  }

  /** Session illisible, ou refusée à cause de ses années : mise de côté, message, session vierge. */
  async function sessionMiseDeCote(raison: RaisonDeLaCopie, title: string, explication: string): Promise<SessionState> {
    const { phrase } = await garderUneCopie(cheminDeLaSession, raison, true)
    avertir({ type: "warning", title, message: `${explication}\n\n${phrase}\n\nL'application a démarré avec une nouvelle simulation vierge.` })
    return SessionStateSchema.parse({})
  }

  async function lireLaSessionEnregistree(): Promise<SessionState> {
    const lecture = await lireLeFichier(cheminDeLaSession)
    // Premier lancement : il n'y a simplement pas encore de session, ce n'est pas une erreur.
    if (lecture.etat === "absent") return SessionStateSchema.parse({})
    if (lecture.etat === "inaccessible") {
      avertir({ type: "warning", title: "Chargement échoué", message: `Votre session précédente n'a pas pu être lue (erreur ${lecture.code}). Le fichier ne sera pas modifié tant que l'application reste ouverte, et la sauvegarde automatique est suspendue :\n${cheminDeLaSession}\n\nL'application a démarré avec une nouvelle simulation vierge.` })
      return SessionStateSchema.parse({})
    }

    const illisible = () => sessionMiseDeCote("illisible", "Chargement échoué", "Votre session précédente n'a pas pu être lue : le fichier est abîmé ou n'est pas une session du simulateur.")
    const brut = jsonOuRien(lecture.contenu)
    if (typeof brut !== "object" || brut === null || Array.isArray(brut)) {
      console.warn("Session illisible, mise de côté.")
      return illisible()
    }

    let lue: ReturnType<typeof lireLaSession>
    try {
      lue = lireLaSession(lecture.contenu)
    } catch (error) {
      if (error instanceof AnneesRefuseesError) return sessionMiseDeCote("refuse", "Chargement refusé", `Votre session précédente n'a pas été chargée.\n\n${error.message}`)
      console.warn("Session impossible à nettoyer, mise de côté :", error)
      return illisible()
    }
    const { safeState, report, versionOrigine } = lue

    const sections = sectionDesPertes(report)
    const pertes = sections.length > 0
    let aReecrire = versionOrigine < FORMAT_VERSION_ACTUEL
    // Un fichier d'un format précédent est converti une fois pour toutes, après copie de l'original.
    if (aReecrire) await copieAvantConversion(cheminDeLaSession, versionOrigine)
    if (report.migrationNotes.length > 0) {
      sections.push(`Elle a été convertie au nouveau format du simulateur. Points à vérifier :\n\n${formatMigrationNotes(report.migrationNotes)}`)
    }
    // Ce que le nettoyage a retiré serait perdu à la prochaine écriture : le fichier d'origine est copié d'abord.
    if (pertes) {
      const { copie, phrase } = await garderUneCopie(cheminDeLaSession, "refuse")
      sections.push(phrase)
      aReecrire = copie
    }
    if (aReecrire) await ecrireLaSession(safeState)

    if (sections.length > 0) {
      avertir({ type: "info", title: "Chargement de la session", message: `Votre session précédente a été chargée.\n\n${sections.join("\n\n")}` })
    }
    return safeState
  }

  // --- Sauvegardes nommées ---

  async function ecrireLesSauvegardesValidees(slots: SaveSlot[]) {
    await ecrireAtomiquement(cheminDesSauvegardes, contenuDesSauvegardes(slots))
  }

  /**
   * Enregistre les sauvegardes reçues de l'interface, validées avant écriture comme à la lecture (une sauvegarde
   * invalide est écartée au lieu d'abîmer le fichier). Réussite ou échec sont notifiés (la réussite seulement si
   * `silencieux` n'est pas demandé). `false` si le fichier n'a pas pu être écrit : il reste alors tel qu'il était.
   */
  async function ecrireLesSauvegardes(slots: SaveSlot[], options?: { silencieux?: boolean }): Promise<boolean> {
    const slotsValides = sauvegardesAEcrire(slots)
    if (slotsValides.length < slots.length) console.warn(`Sauvegardes invalides écartées avant écriture : ${slots.length - slotsValides.length}.`)
    try {
      await ecrireLesSauvegardesValidees(slotsValides)
    } catch (error) {
      console.error("Erreur lors de la sauvegarde des slots :", error)
      notifier({ message: MESSAGES.echecDesSauvegardes, type: "error" })
      return false
    }
    if (!options?.silencieux) notifier({ message: MESSAGES.sauvegardeReussie, type: "success" })
    return true
  }

  async function lireLesSauvegardesEnregistrees(): Promise<SaveSlot[]> {
    const lecture = await lireLeFichier(cheminDesSauvegardes)
    if (lecture.etat === "absent") return []
    if (lecture.etat === "inaccessible") {
      avertir({ type: "warning", title: "Sauvegardes illisibles", message: `Le fichier de vos sauvegardes n'a pas pu être lu (erreur ${lecture.code}). Il ne sera pas modifié tant que l'application reste ouverte, et aucune sauvegarde ne pourra être enregistrée :\n${cheminDesSauvegardes}\n\nFermez l'application et vérifiez ce fichier avant de la relancer.` })
      return []
    }

    // Un fichier qui n'est pas une liste de sauvegardes est mis de côté en entier : la liste repart vide.
    if (!Array.isArray(jsonOuRien(lecture.contenu))) {
      console.warn("Fichier des sauvegardes illisible, mis de côté.")
      const { phrase } = await garderUneCopie(cheminDesSauvegardes, "illisible", true)
      avertir({ type: "warning", title: "Sauvegardes illisibles", message: `Le fichier de vos sauvegardes n'a pas pu être lu : il est abîmé ou n'est pas un fichier de sauvegardes du simulateur.\n\n${phrase}\n\nLa liste des sauvegardes est vide ; les prochaines seront enregistrées dans un nouveau fichier.` })
      return []
    }

    // Les sauvegardes illisibles, ou refusées à cause de leurs années, disparaîtraient à la prochaine écriture : le
    // fichier est copié d'abord, puis réécrit avec celles qui ont été gardées.
    const { slots, refusees, brutes: rawSlots } = lireLesSauvegardes(lecture.contenu)
    const illisibles = rawSlots.length - slots.length - refusees.length
    let aReecrire = false
    if (refusees.length > 0 || illisibles > 0) {
      const { copie, phrase } = await garderUneCopie(cheminDesSauvegardes, "refuse")
      aReecrire = copie
      const parties: string[] = []
      if (refusees.length > 0) parties.push(`${pluriel(refusees.length, "Cette sauvegarde n'a pas été chargée", "Ces sauvegardes n'ont pas été chargées")} :\n\n${refusees.map(({ nom, raison }) => `- « ${nom} » : ${raison}`).join("\n\n")}`)
      if (illisibles > 0) parties.push(`${illisibles} ${pluriel(illisibles, "sauvegarde illisible a été écartée", "sauvegardes illisibles ont été écartées")} (identifiant, date ou contenu invalides).`)
      avertir({ type: "warning", title: refusees.length > 0 ? "Sauvegardes refusées" : "Sauvegardes illisibles", message: `${parties.join("\n\n")}\n\n${phrase}` })
    }

    // Des sauvegardes d'un format précédent sont converties une fois pour toutes, après copie de l'original. Seules
    // comptent celles qui ont été gardées.
    const gardees = new Set(slots.map(slot => slot.id))
    const oldSlots = rawSlots.filter(slot => versionDuFormat(slot) < FORMAT_VERSION_ACTUEL && gardees.has((slot as { id?: string }).id ?? ""))
    if (oldSlots.length > 0) {
      await copieAvantConversion(cheminDesSauvegardes, Math.min(...oldSlots.map(versionDuFormat)))
      aReecrire = true
      const notes = [...new Set(oldSlots.flatMap(slot => migrerVersFormatActuel(slot).notes))]
      avertir({
        type: "info",
        title: "Sauvegardes converties",
        message: `${oldSlots.length} sauvegarde${oldSlots.length > 1 ? "s ont été converties" : " a été convertie"} au nouveau format du simulateur.${notes.length > 0 ? `\n\nÀ l'ouverture de chacune, vérifiez :\n\n${formatMigrationNotes(notes)}` : ""}`
      })
    }

    if (aReecrire) await ecrireLesSauvegardesValidees(slots).catch(error => console.error("Sauvegardes nettoyées impossibles à réécrire :", error))
    return slots
  }

  // --- Préférences ---

  /**
   * Lit les préférences, validées comme dans la démo web : un champ invalide est écarté seul. Un fichier illisible
   * donne les préférences par défaut ; il est mis de côté (`userPreferences.illisible-….json`), sans boîte de
   * dialogue : rien de la simulation n'est perdu.
   */
  async function lireLesPreferencesEnregistrees(): Promise<UserPreferences> {
    const lecture = await lireLeFichier(cheminDesPreferences)
    if (lecture.etat !== "lu") return preferencesParDefaut()
    try {
      return lireLesPreferences(lecture.contenu)
    } catch (error) {
      console.warn("Fichier de préférences illisible, retour aux valeurs par défaut :", error instanceof Error ? error.message : error)
      await copierACote(cheminDesPreferences, "illisible", { maintenant: maintenant(), deplacer: true })
      return preferencesParDefaut()
    }
  }

  /** Enregistre les préférences, validées avant écriture comme à la lecture ; un échec est notifié une fois. */
  async function ecrireLesPreferences(prefs: UserPreferences): Promise<void> {
    try {
      await ecrireAtomiquement(cheminDesPreferences, JSON.stringify(preferencesValides(prefs), null, 2))
      echecDesPreferences.reussite()
    } catch (error) {
      console.error("Erreur lors de la sauvegarde des préférences :", error)
      echecDesPreferences.echec()
    }
  }

  return {
    lireLaSession: lireLaSessionEnregistree,
    ecrireLaSession,
    ecrireLaSessionSync,
    lireLesSauvegardes: lireLesSauvegardesEnregistrees,
    ecrireLesSauvegardes,
    lireLesPreferences: lireLesPreferencesEnregistrees,
    ecrireLesPreferences
  }
}
