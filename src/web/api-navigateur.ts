// src/web/api-navigateur.ts
// Pont de la démo web : il remplace le process principal d'Electron (src/backend/main.ts). Le moteur tourne
// dans la page, et la session, les sauvegardes et les préférences sont stockées dans le navigateur (stockage-navigateur.ts).
// L'interface ne voit aucune différence : elle appelle toujours window.api.

import type { EventPayloadMapping } from "@/globals"
import type { ExportableState, FormatFichierTexte, NotificationPayload, SaveSlot, SessionState, UserPreferences } from "@/types"
import { SessionStateSchema, UserPreferencesSchema } from "@/types"
import { comparerStatuts } from "@/backend/logic/comparateur"
import { optimiserRemuneration } from "@/backend/logic/optimisation-remuneration"
import { sanitizeSlots, sanitizeStateAndFillDefaults } from "@/backend/logic/data-sanitizer"
import { FORMAT_VERSION_ACTUEL } from "@/backend/logic/migrations"
import { runMetaSimulation } from "@/backend/logic/simulation-engine"
import { sessionExemple } from "./session-exemple"
import { CLES, ecrire, lire } from "./stockage-navigateur"

const avecFormat = <T extends object>(donnees: T) => ({ ...donnees, formatVersion: FORMAT_VERSION_ACTUEL })

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

  const enregistrerSession = (session: SessionState) => ecrire(CLES.session, avecFormat(session))

  return {
    // À la première visite, la démo s'ouvre sur une simulation d'exemple plutôt que sur une page vide.
    getCurrentSession: async () => {
      const enregistree = lire(CLES.session)
      return enregistree === null ? sessionExemple() : sanitizeStateAndFillDefaults(enregistree).safeState
    },
    saveCurrentSession: async session => enregistrerSession(session),
    saveCurrentSessionSync: session => enregistrerSession(session),

    runMetaSimulation: async session => runMetaSimulation(sessionValidee(session)),
    compareStatuts: async (session, options) => comparerStatuts(sessionValidee(session), options),
    optimiserRemuneration: async (session, options, statut) => optimiserRemuneration(sessionValidee(session), options, statut),

    getSaveSlots: async () => sanitizeSlots(lire(CLES.sauvegardes) ?? []),
    saveSlots: async (slots: SaveSlot[]) => {
      ecrire(CLES.sauvegardes, slots.map(avecFormat))
      notifier({ message: "Sauvegarde réussie !", type: "success" })
    },

    exportState: async (state: ExportableState) => telecharger(`simulateur-export-${Date.now()}.json`, avecFormat(state)),
    importState: async () => {
      const contenu = await choisirFichier()
      if (contenu === null) return { data: undefined }
      try {
        const { safeState, report } = sanitizeStateAndFillDefaults(JSON.parse(contenu))
        return { data: { entities: safeState.entities, relationships: safeState.relationships, monthlyData: safeState.monthlyData }, report }
      } catch (error) {
        const message = error instanceof Error ? error.message : "Erreur inconnue."
        notifier({ message: `Le fichier sélectionné est invalide ou corrompu : ${message}`, type: "error" })
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

    getUserPreferences: async () => {
      const resultat = UserPreferencesSchema.safeParse(lire(CLES.preferences))
      return resultat.success ? resultat.data : { slotOrder: [] }
    },
    saveUserPreferences: async (prefs: UserPreferences) => ecrire(CLES.preferences, prefs),

    onShowNotification: callback => {
      abonnes.add(callback)
      return () => abonnes.delete(callback)
    }
  }
}
