// src/web/api-navigateur.ts
// Pont de la démo web : il remplace le process principal d'Electron (src/backend/main.ts). Le moteur tourne
// dans la page, et la session, les sauvegardes et les préférences sont stockées dans le navigateur (stockage-navigateur.ts).
// L'interface ne voit aucune différence : elle appelle toujours window.api.

import type { EventPayloadMapping } from "@/globals"
import type { ExportableState, FormatFichierTexte, NotificationPayload, SaveSlot, SessionState, UserPreferences } from "@/types"
import { SessionStateSchema } from "@/types"
import { AnneesRefuseesError, sanitizeSlots, sanitizeStateAndFillDefaults } from "@/backend/logic/data-sanitizer"
import { avecVersionDeLApplication, lireUneSimulationImportee, preferencesValides } from "@/backend/logic/fichiers-de-donnees"
import { FORMAT_VERSION_ACTUEL } from "@/backend/logic/migrations"
import { comparerStatutsDeLAnnee, optimiserRemunerationDeLAnnee, simulerLesAnnees } from "@/backend/logic/simulation-pluriannuelle"
import { comparerStrategiesDeDistribution } from "@/backend/logic/strategies-de-distribution"
import { adresseExterneAutorisee } from "@/lib/adresses-des-retours"
import { VERSION_DE_L_APPLICATION } from "@/lib/version"
import { sessionExemple } from "./session-exemple"
import { CLES, demanderUnStockagePersistant, ecrire, lire } from "./stockage-navigateur"

const avecFormat = <T extends object>(donnees: T) => ({ ...donnees, formatVersion: FORMAT_VERSION_ACTUEL })
/** Un fichier écrit par la démo (session, export) : son format et la version de l'application qui l'écrit. */
const ecritParLaDemo = <T extends object>(donnees: T) => avecFormat(avecVersionDeLApplication(donnees, VERSION_DE_L_APPLICATION))

/**
 * La session conservée dans le navigateur, nettoyée. Elle n'est écrite que par la démo : si ses années sont
 * refusées (modifiées à la main dans les outils du navigateur), la démo repart d'une session vierge.
 */
function sessionEnregistree(enregistree: unknown): SessionState {
  try {
    return sanitizeStateAndFillDefaults(enregistree).safeState
  } catch (error) {
    console.warn("Session du navigateur refusée, démarrage avec une session vierge :", error instanceof Error ? error.message : error)
    return SessionStateSchema.parse({})
  }
}

/** Session reçue de l'interface, revalidée avant calcul, comme le fait le process principal. */
function sessionValidee(session: unknown): SessionState {
  const resultat = SessionStateSchema.safeParse(session)
  return resultat.success ? resultat.data : SessionStateSchema.parse({})
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

export function creerApiNavigateur(): EventPayloadMapping {
  const abonnes = new Set<(payload: NotificationPayload) => void>()
  const notifier = (payload: NotificationPayload) => abonnes.forEach(abonne => abonne(payload))

  const enregistrerSession = (session: SessionState) => ecrire(CLES.session, ecritParLaDemo(session))

  return {
    // À la première visite, la démo s'ouvre sur une simulation d'exemple plutôt que sur une page vide.
    getCurrentSession: async () => {
      const enregistree = lire(CLES.session)
      return enregistree === null ? sessionExemple() : sessionEnregistree(enregistree)
    },
    saveCurrentSession: async session => enregistrerSession(session),
    saveCurrentSessionSync: session => enregistrerSession(session),

    simulerLesAnnees: async session => simulerLesAnnees(sessionValidee(session)),
    compareStatuts: async (session, options, annee) => comparerStatutsDeLAnnee(sessionValidee(session), options, annee),
    optimiserRemuneration: async (session, options, statut, annee) => optimiserRemunerationDeLAnnee(sessionValidee(session), options, statut, annee),
    comparerStrategies: async (session, activityId) => {
      const validee = sessionValidee(session)
      return comparerStrategiesDeDistribution(validee, activityId, validee.comparateur?.reglagesParActivite[activityId])
    },

    getSaveSlots: async () => sanitizeSlots(lire(CLES.sauvegardes) ?? []),
    // Validées avant écriture, comme dans l'application de bureau.
    saveSlots: async (slots: SaveSlot[], options) => {
      ecrire(CLES.sauvegardes, sanitizeSlots(slots.map(avecFormat)).map(avecFormat))
      if (!options?.silencieux) notifier({ message: "Sauvegarde réussie !", type: "success" })
      // Les sauvegardes sont ce que l'utilisateur tient à garder : le navigateur est prié de ne pas les effacer de lui-même.
      void demanderUnStockagePersistant()
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
    saveUserPreferences: async (prefs: UserPreferences) => ecrire(CLES.preferences, preferencesValides(prefs)),

    onShowNotification: callback => {
      abonnes.add(callback)
      return () => abonnes.delete(callback)
    },

    // Le serveur MCP local et sa boîte aux propositions n'existent que dans l'application de bureau.
    infosDuServeurMcp: async () => null,
    propositionsEnAttente: async () => [],
    retirerProposition: async () => false,
    onPropositionsEnAttente: () => () => undefined
  }
}
