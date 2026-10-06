// src/backend/copie-du-serveur-mcp.ts
// Version du Microsoft Store (paquet MSIX) : le serveur MCP livré se trouve dans le dossier du paquet, sous
// C:\Program Files\WindowsApps, dont le nom change à chaque mise à jour. L'application en garde donc une copie à un
// chemin stable, dans son dossier de données, et la tient à jour à chaque démarrage (voir l'ADR 013).

import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises"
import path from "node:path"

/**
 * Copie le serveur livré vers `destination` s'il en diffère. L'écriture passe par un fichier temporaire renommé : un
 * client d'IA qui lance le serveur au même moment lit l'ancienne version ou la nouvelle, jamais un fichier tronqué.
 * Renvoie `true` si la copie a été (ré)écrite.
 */
export async function copierLeServeurMcp(source: string, destination: string): Promise<boolean> {
  const contenu = await readFile(source)
  const actuel = await readFile(destination).catch(() => null)
  if (actuel?.equals(contenu)) return false
  await mkdir(path.dirname(destination), { recursive: true })
  const temporaire = `${destination}.${process.pid}.tmp`
  try {
    await writeFile(temporaire, contenu)
    await rename(temporaire, destination)
  } finally {
    await rm(temporaire, { force: true })
  }
  return true
}
