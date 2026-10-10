// src/backend/canaux-de-la-session.ts

/*
 * Canaux IPC des données de l'utilisateur : session en cours, sauvegardes nommées et préférences, lues et écrites par
 * `donneesDeLApplication` (voir l'ADR 005). Chaque canal passe par `ipcMainHandle` (émetteur vérifié) et vérifie ses
 * paramètres (logic/entrees-ipc.ts, nettoyage de la session) avant d'écrire quoi que ce soit.
 */

import { ipcMain } from "electron"
import type { SaveSlot, SessionState, UserPreferences } from "../types.js"
import type { donneesDeLApplication } from "./donnees-de-l-application.js"
import { sessionAEcrire } from "./logic/fichiers-de-donnees.js"
import { OptionsDesSauvegardesSchema, SauvegardesRecuesSchema, entreeValide } from "./logic/entrees-ipc.js"
import { ipcMainHandle, validateEventFrame } from "./util.js"

type DonneesDeLApplication = ReturnType<typeof donneesDeLApplication>

export function declarerLesCanauxDeLaSession(donnees: DonneesDeLApplication) {
  ipcMainHandle("getCurrentSession", async () => await donnees.lireLaSession())
  // La session reçue est nettoyée comme à la lecture ; ce qui n'est pas une session n'est pas écrit.
  ipcMainHandle("saveCurrentSession", async (session: SessionState) => {
    const valide = sessionAEcrire(session)
    if (valide === null) console.warn("saveCurrentSession : session refusée, rien n'est écrit.")
    else await donnees.ecrireLaSession(valide)
  })

  // Enregistrement synchrone, appelé par l'interface quand la fenêtre se ferme : la sauvegarde automatique
  // est différée d'une seconde, et une modification faite juste avant la fermeture serait sinon perdue.
  // Comme pour les autres canaux : émetteur vérifié, session nettoyée. Un refus répond `false` sans bloquer la page.
  ipcMain.on("saveCurrentSessionSync", (event, session: SessionState) => {
    try {
      validateEventFrame(event.senderFrame)
    } catch (error) {
      console.error("saveCurrentSessionSync refusé :", error)
      event.returnValue = false
      return
    }
    const valide = sessionAEcrire(session)
    if (valide === null) console.warn("saveCurrentSessionSync : session refusée, rien n'est écrit.")
    event.returnValue = valide !== null && donnees.ecrireLaSessionSync(valide)
  })

  ipcMainHandle("getSaveSlots", async () => await donnees.lireLesSauvegardes())
  // Une liste est exigée ; chaque sauvegarde est ensuite validée seule, comme à la lecture.
  ipcMainHandle("saveSlots", async (slots: SaveSlot[], options?: { silencieux?: boolean }) =>
    await donnees.ecrireLesSauvegardes(entreeValide(SauvegardesRecuesSchema, slots, "saveSlots") as SaveSlot[], entreeValide(OptionsDesSauvegardesSchema, options, "saveSlots"))
  )

  ipcMainHandle("getUserPreferences", async () => await donnees.lireLesPreferences())
  ipcMainHandle("saveUserPreferences", async (prefs: UserPreferences) => await donnees.ecrireLesPreferences(prefs))
}
