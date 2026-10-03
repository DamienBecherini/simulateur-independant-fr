import path from "path"
import { app } from "electron"

export function getPreloadPath() {
  // Une fois packagé, preload.cjs est copié hors de l'archive asar (extraResources d'electron-builder.json).
  return path.join(app.getAppPath(), app.isPackaged ? "../" : "./", "/dist-electron/backend/preload.cjs")
}

export function getUIPath() {
  return path.join(app.getAppPath(), "/dist-react/index.html")
}
