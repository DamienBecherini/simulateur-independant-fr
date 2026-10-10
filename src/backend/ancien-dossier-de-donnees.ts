// src/backend/ancien-dossier-de-donnees.ts

/*
 * Reprise des données d'avant le changement de nom du paquet. Le dossier de données suit le nom du paquet ; jusqu'à
 * la version 0.9, ce nom était « electron-vite-template ». À appeler au lancement, avant toute lecture des données.
 */

import { app } from "electron"
import path from "node:path"
import { copyFileSync, existsSync, mkdirSync } from "node:fs"

/** Fichiers de données conservés d'une version à l'autre. */
const DATA_FILES = ["sessionState.json", "simulationSlots.json", "userPreferences.json"]

/**
 * Au premier lancement, si le nouveau dossier ne contient encore aucune donnée, on y recopie l'ancien. L'ancien
 * dossier n'est pas supprimé. Un dossier imposé au lancement (--user-data-dir, comme dans les tests de bout en bout)
 * n'est jamais concerné : il doit rester tel qu'on le fournit.
 */
export function recopierAncienDossierDeDonnees() {
  if (app.commandLine.hasSwitch("user-data-dir")) return
  const dossier = app.getPath("userData")
  const ancien = path.join(app.getPath("appData"), "electron-vite-template")
  if (ancien === dossier || !existsSync(ancien) || DATA_FILES.some(f => existsSync(path.join(dossier, f)))) return
  mkdirSync(dossier, { recursive: true })
  for (const fichier of DATA_FILES) {
    if (existsSync(path.join(ancien, fichier))) copyFileSync(path.join(ancien, fichier), path.join(dossier, fichier))
  }
  console.info(`Données reprises de l'ancien dossier : ${ancien}`)
}
