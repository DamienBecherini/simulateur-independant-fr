// src/electron/util.ts

import { ipcMain, WebFrameMain } from "electron"
import { getUIPath } from "./pathResolver.js"
import { pathToFileURL } from "url"
import type { EventPayloadMapping } from "@/globals.js"
import { isDev } from "./isDev.js"

// === VERSION DÉFINITIVE - ZÉRO 'any' ===
export function ipcMainHandle<Key extends keyof EventPayloadMapping>(key: Key, handler: EventPayloadMapping[Key]) {
  // 1. On déduit le type des arguments de la fonction handler
  type HandlerParams = Parameters<EventPayloadMapping[Key]>

  // 2. On déduit le type de la valeur de retour de la fonction handler
  type HandlerReturn = ReturnType<EventPayloadMapping[Key]>

  ipcMain.handle(key, (event, ...args: HandlerParams): HandlerReturn => {
    if (event.senderFrame) validateEventFrame(event.senderFrame)

    // L'appel est maintenant entièrement sécurisé, tant pour les arguments
    // que pour la valeur de retour.
    return (handler as (...args: HandlerParams) => HandlerReturn)(...args)
  })
}

export function validateEventFrame(frame: WebFrameMain) {
  if (isDev() && new URL(frame.url).host === "localhost:3524") return // Assurez-vous que le port est correct
  if (frame.url !== pathToFileURL(getUIPath()).toString()) throw new Error("Malicious event")
}
