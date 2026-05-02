import path from "path"
import { app } from "electron"

export function getPreloadPath() {
    // Sortie tsc : src/electron → dist-electron/electron (voir tsconfig include / rootDir implicite)
    return path.join(app.getAppPath(), "dist-electron", "electron", "preload.cjs")
}

export function getUIPath() {
    return path.join(app.getAppPath(), "dist-react", "index.html")
}
