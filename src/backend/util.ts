// src/backend/util.ts

import { ipcMain, type WebFrameMain } from "electron"
import { getUIPath } from "./pathResolver.js"
import { pathToFileURL } from "url"
import type { EventPayloadMapping } from "@/globals.js"
import { isDev } from "./isDev.js"
import { ADRESSE_DU_SERVEUR_DE_DEVELOPPEMENT } from "./securite-des-fenetres.js"

/**
 * Déclare un canal IPC typé par `EventPayloadMapping`. L'émetteur est vérifié avant tout (`validateEventFrame`) ; les
 * paramètres, eux, sont vérifiés par chaque gestionnaire (src/backend/logic/entrees-ipc.ts).
 */
export function ipcMainHandle<Key extends keyof EventPayloadMapping>(key: Key, handler: EventPayloadMapping[Key]) {
  type HandlerParams = Parameters<EventPayloadMapping[Key]>
  type HandlerReturn = ReturnType<EventPayloadMapping[Key]>

  ipcMain.handle(key, (event, ...args: HandlerParams): HandlerReturn => {
    validateEventFrame(event.senderFrame)
    return (handler as (...args: HandlerParams) => HandlerReturn)(...args)
  })
}

/**
 * Refuse un appel IPC qui ne vient pas de l'interface de l'application : le cadre émetteur doit afficher la page de
 * l'interface (ou, en développement, le serveur de développement). Un appel sans cadre émetteur (cadre détruit ou
 * déjà parti vers une autre page) est refusé lui aussi : on ne sait pas d'où il vient.
 * @throws Si l'émetteur n'est pas l'interface.
 */
export function validateEventFrame(frame: WebFrameMain | null) {
  if (frame === null) throw new Error("Malicious event: no sender frame")
  const url = new URL(frame.url)
  if (isDev() && url.origin === ADRESSE_DU_SERVEUR_DE_DEVELOPPEMENT) return
  // Le fragment de l'adresse (#resultats, affichage « Trois vues ») désigne une vue de la même page : il est ignoré.
  url.hash = ""
  if (url.toString() !== pathToFileURL(getUIPath()).toString()) throw new Error("Malicious event")
}
