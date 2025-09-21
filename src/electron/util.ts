// src/electron/util.ts

import { ipcMain, WebFrameMain } from "electron"
import { getUIPath } from "./pathResolver.js"
import { pathToFileURL } from "url"

// L'import de types a été retiré, car ils sont maintenant globaux.

export function isDev(): boolean {
  return process.env.NODE_ENV === "development"
}

// MODIFIÉ : Version finale sans 'any'
export function ipcMainHandle<Key extends keyof EventPayloadMapping>(key: Key, handler: EventPayloadMapping[Key]) {
  ipcMain.handle(key, event => {
    if (event.senderFrame) validateEventFrame(event.senderFrame)
    // L'appel est maintenant directement typé, sans 'any'
    return handler()
  })
}

export function validateEventFrame(frame: WebFrameMain) {
  if (isDev() && new URL(frame.url).host === "localhost:3524") return
  if (frame.url !== pathToFileURL(getUIPath()).toString()) throw new Error("Malicious event")
}
