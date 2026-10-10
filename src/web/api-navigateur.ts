// src/web/api-navigateur.ts
// Pont de la démo web : il remplace le process principal d'Electron (src/backend/main.ts). Le moteur tourne
// dans la page, et la session, les sauvegardes et les préférences sont stockées dans le navigateur (stockage-navigateur.ts).
// L'interface ne voit aucune différence : elle appelle toujours window.api.

import type { EventPayloadMapping } from "@/globals"
import type { ExportableState, FormatFichierTexte, NotificationPayload, SaveSlot, SessionState, UserPreferences } from "@/types"
import { SessionStateSchema } from "@/types"
import { AnneesRefuseesError, nettoyerLaSession, sanitizeSlots, SessionIrrecuperableError } from "@/backend/logic/data-sanitizer"
import { avecVersionDeLApplication, lireUneSimulationImportee, preferencesValides } from "@/backend/logic/fichiers-de-donnees"
import { FORMAT_VERSION_ACTUEL } from "@/backend/logic/migrations"
import { calculsDuPont } from "@/backend/logic/calculs-du-pont"
import { adresseExterneAutorisee } from "@/lib/adresses-des-retours"
import { VERSION_DE_L_APPLICATION } from "@/lib/version"
import { sessionExemple } from "./session-exemple"
import { CLES, demanderUnStockagePersistant, ecrire, lire, lireAvecEtat, mettreDeCote } from "./stockage-navigateur"

const avecFormat = <T extends object>(donnees: T) => ({ ...donnees, formatVersion: FORMAT_VERSION_ACTUEL })
/** Un fichier écrit par la démo (session, export) : son format et la version de l'application qui l'écrit. */
const ecritParLaDemo = <T extends object>(donnees: T) => avecFormat(avecVersionDeLApplication(donnees, VERSION_DE_L_APPLICATION))

/**
 * La session conservée dans le navigateur, nettoyée ; `null` si elle est refusée en bloc par le schéma (pas un
 * objet, nom qui n'est pas un texte, grille inutilisable…) : elle est alors illisible, et mise de côté comme un JSON
 * invalide. Elle n'est écrite que par la démo : si ses années sont refusées (modifiées à la main dans les outils du
 * navigateur), la démo repart d'une session vierge.
 */
function sessionEnregistree(enregistree: unknown): SessionState | null {
  try {
    return nettoyerLaSession(enregistree).safeState
  } catch (error) {
    if (error instanceof SessionIrrecuperableError) return null
    console.warn("Session du navigateur refusée, démarrage avec une session vierge :", error instanceof Error ? error.message : error)
    return SessionStateSchema.parse({})
  }
}

const TYPES_MIME: Record<FormatFichierTexte, string> = { csv: "text/csv;charset=utf-8", markdown: "text/markdown;charset=utf-8", json: "application/json" }
const EXTENSIONS: Record<FormatFichierTexte, string> = { csv: ".csv", markdown: ".md", json: ".json" }

/** Fait télécharger un fichier JSON au navigateur. */
function telecharger(nom: string, contenu: unknown) {
  telechargerTexte(nom, JSON.stringify(contenu, null, 2), "json")
}

/** Fait télécharger un fichier texte au navigateur. */
function telechargerTexte(nom: string, contenu: string, format: FormatFichierTexte) {
  const url = URL.createObjectURL(new Blob([contenu], { type: TYPES_MIME[format] }))
  const lien = document.createElement("a")
  lien.href = url
  lien.download = nom
  lien.click()
  URL.revokeObjectURL(url)
}

/** Ouvre le sélecteur de fichiers et renvoie le contenu du fichier choisi, ou `null` s'il est annulé. */
function choisirFichier(format: FormatFichierTexte = "json"): Promise<string | null> {
  return new Promise(resolve => {
    const champ = document.createElement("input")
    champ.type = "file"
    champ.accept = `${TYPES_MIME[format].split(";")[0]},${EXTENSIONS[format]}`
    champ.addEventListener("change", () => {
      const fichier = champ.files?.[0]
      if (!fichier) return resolve(null)
      fichier.text().then(resolve, () => resolve(null))
    })
    champ.addEventListener("cancel", () => resolve(null))
    champ.click()
  })
}

/** Messages de la démo quand le stockage du navigateur refuse une écriture ou rend une valeur illisible. */
export const MESSAGES_DE_LA_DEMO = {
  sauvegardeReussie: "Sauvegarde réussie !",
  echecDesSauvegardes: "Échec de la sauvegarde : le stockage du navigateur est plein ou bloqué. Vos sauvegardes précédentes sont intactes.",
  echecDeLaSession: "Échec de la sauvegarde automatique : le stockage du navigateur est plein ou bloqué. Vos dernières modifications ne sont pas enregistrées.",
  echecDesPreferences: "Échec de l'enregistrement des préférences : le stockage du navigateur est plein ou bloqué.",
  stockageBloque: "Le stockage du navigateur est bloqué (réglages de confidentialité ?) : la démo fonctionne, mais rien ne sera enregistré."
} as const

/** Phrase qui désigne la copie d'une valeur illisible, ou qui dit qu'elle est protégée faute de copie. */
function phraseDeLaCopie(copie: string | null, sansCopie: string): string {
  return copie === null ? sansCopie : `Une copie, telle quelle, a été gardée sous la clé « ${copie} » du stockage du navigateur.`
}

export function creerApiNavigateur(): EventPayloadMapping {
  const abonnes = new Set<(payload: NotificationPayload) => void>()
  // Les messages du chargement partent avant que l'interface soit abonnée : ils attendent le premier abonné.
  const enAttente: NotificationPayload[] = []
  const notifier = (payload: NotificationPayload) => {
    if (abonnes.size === 0) enAttente.push(payload)
    abonnes.forEach(abonne => abonne(payload))
  }

  /** Un échec d'écriture automatique n'est notifié qu'une fois, jusqu'à la prochaine écriture réussie. */
  const echecsSignales = new Set<string>()
  const ecrireOuSignaler = (cle: (typeof CLES)[keyof typeof CLES], valeur: unknown, message: string) => {
    if (ecrire(cle, valeur)) echecsSignales.delete(cle)
    else if (!echecsSignales.has(cle)) {
      echecsSignales.add(cle)
      notifier({ message, type: "error" })
    }
  }

  const enregistrerSession = (session: SessionState) => ecrireOuSignaler(CLES.session, ecritParLaDemo(session), MESSAGES_DE_LA_DEMO.echecDeLaSession)

  return {
    // À la première visite, la démo s'ouvre sur une simulation d'exemple plutôt que sur une page vide. Une session
    // illisible est mise de côté, et la démo repart aussi de l'exemple.
    getCurrentSession: async () => {
      const lecture = lireAvecEtat(CLES.session)
      const session = lecture.etat === "lu" ? sessionEnregistree(lecture.valeur) : null
      if (session !== null) return session
      if (lecture.etat === "inaccessible") notifier({ message: MESSAGES_DE_LA_DEMO.stockageBloque, type: "warning" })
      else if (lecture.etat !== "absent") {
        const copie = mettreDeCote(CLES.session, lecture.brut)
        notifier({ message: `Votre session enregistrée dans ce navigateur n'a pas pu être lue. ${phraseDeLaCopie(copie, "Elle n'a pas pu être mise de côté (stockage plein ?) : elle ne sera pas remplacée pendant cette visite.")} La démo a redémarré sur la simulation d'exemple.`, type: "warning" })
      }
      return sessionExemple()
    },
    saveCurrentSession: async session => enregistrerSession(session),
    saveCurrentSessionSync: session => enregistrerSession(session),

    // Calculs communs avec l'application de bureau (calculs-du-pont.ts) : la session reçue y est revalidée.
    simulerLesAnnees: async session => calculsDuPont.simulerLesAnnees(session),
    compareStatuts: async (session, options, annee) => calculsDuPont.compareStatuts(session, options, annee),
    optimiserRemuneration: async (session, options, statut, annee) => calculsDuPont.optimiserRemuneration(session, options, statut, annee),
    comparerStrategies: async (session, activityId) => calculsDuPont.comparerStrategies(session, activityId),

    // Des sauvegardes illisibles sont mises de côté avant que la prochaine sauvegarde ne les remplace.
    getSaveSlots: async () => {
      const lecture = lireAvecEtat(CLES.sauvegardes)
      if (lecture.etat === "lu" && Array.isArray(lecture.valeur)) return sanitizeSlots(lecture.valeur)
      if (lecture.etat === "lu" || lecture.etat === "illisible") {
        const copie = mettreDeCote(CLES.sauvegardes, lecture.brut)
        notifier({ message: `Vos sauvegardes enregistrées dans ce navigateur n'ont pas pu être lues. ${phraseDeLaCopie(copie, "Elles n'ont pas pu être mises de côté (stockage plein ?) : elles ne seront pas remplacées pendant cette visite.")} La liste des sauvegardes est vide.`, type: "warning" })
      }
      return []
    },
    // Validées avant écriture, comme dans l'application de bureau.
    saveSlots: async (slots: SaveSlot[], options) => {
      if (!ecrire(CLES.sauvegardes, sanitizeSlots(slots.map(avecFormat)).map(avecFormat))) {
        notifier({ message: MESSAGES_DE_LA_DEMO.echecDesSauvegardes, type: "error" })
        return false
      }
      if (!options?.silencieux) notifier({ message: MESSAGES_DE_LA_DEMO.sauvegardeReussie, type: "success" })
      // Les sauvegardes sont ce que l'utilisateur tient à garder : le navigateur est prié de ne pas les effacer de lui-même.
      void demanderUnStockagePersistant()
      return true
    },

    exportState: async (state: ExportableState) => telecharger(`simulateur-export-${Date.now()}.json`, ecritParLaDemo(state)),
    importState: async () => {
      const contenu = await choisirFichier()
      if (contenu === null) return { data: undefined }
      try {
        return lireUneSimulationImportee(contenu)
      } catch (error) {
        const message = error instanceof Error ? error.message : "Erreur inconnue."
        // Un fichier refusé à cause de ses années n'est pas corrompu : le motif suffit, il dit quoi corriger.
        notifier({ message: error instanceof AnneesRefuseesError ? `Import impossible. ${message}` : `Le fichier sélectionné est invalide ou corrompu : ${message}`, type: "error" })
        return { error: message }
      }
    },

    saveTextFile: async ({ defaultName, content, format }) => {
      telechargerTexte(defaultName, content, format)
      return true
    },
    openTextFile: async ({ format }) => choisirFichier(format),
    // Le navigateur ne sait pas écrire un PDF sans intervention : on ouvre sa fenêtre d'impression (« Enregistrer en PDF »).
    printToPdf: async () => {
      window.print()
      return true
    },

    // Comme dans l'application de bureau, seules deux adresses s'ouvrent : le formulaire de ticket, dans un nouvel
    // onglet sans lien avec la démo (noopener), et l'e-mail des retours, confié à la messagerie du système.
    ouvrirAdresseExterne: async adresse => {
      if (!adresseExterneAutorisee(adresse)) return false
      if (adresse.startsWith("mailto:")) window.open(adresse, "_self")
      else window.open(adresse, "_blank", "noopener,noreferrer")
      return true
    },

    // Comme dans l'application de bureau, un champ invalide est écarté seul, à la lecture comme à l'écriture.
    getUserPreferences: async () => preferencesValides(lire(CLES.preferences)),
    saveUserPreferences: async (prefs: UserPreferences) => ecrireOuSignaler(CLES.preferences, preferencesValides(prefs), MESSAGES_DE_LA_DEMO.echecDesPreferences),

    onShowNotification: callback => {
      abonnes.add(callback)
      enAttente.splice(0).forEach(callback)
      return () => abonnes.delete(callback)
    },

    // Le serveur MCP local et sa boîte aux propositions n'existent que dans l'application de bureau.
    infosDuServeurMcp: async () => null,
    propositionsEnAttente: async () => [],
    retirerProposition: async () => false,
    onPropositionsEnAttente: () => () => undefined
  }
}
