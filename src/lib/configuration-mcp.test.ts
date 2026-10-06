// src/lib/configuration-mcp.test.ts
// Configuration d'un client d'IA pour le serveur MCP local, et accord entre l'application et le serveur sur la session :
// celle que l'application affiche et celle que le serveur relit dans le fichier ont la même empreinte, sinon toute
// proposition paraîtrait périmée.

import { describe, expect, it } from "vitest"
import type { SessionState } from "@/types"
import { contenuDuFichier, lireLaSession } from "@/backend/logic/fichiers-de-donnees"
import { empreinteDeLaSession } from "@/backend/logic/outils/commun"
import { lireUnePropositionEnAttente, nomDUnePropositionEnAttente, NOM_DE_PROPOSITION } from "@/backend/mcp/proposition-en-attente"
import { MONTAGES_TYPES, sessionDUnMontage } from "@/lib/montages/montages"
import { sessionExemple } from "@/web/session-exemple"
import { ALIAS_D_EXECUTION, commandeDeVerification, configurationDeClaudeDesktop, configurationDuClient, infosDeLInstallation, type InfosDuServeurMcp } from "./configuration-mcp"

const windows: InfosDuServeurMcp = { executable: "C:\\Programmes\\Simulateur.exe", script: "C:\\Programmes\\resources\\mcp\\serveur-mcp.mjs", donnees: "C:\\Users\\a\\AppData\\Roaming\\Simulateur", plateforme: "win32" }

describe("configuration d'un client d'IA", () => {
  it("lance l'exécutable de l'application en mode Node, avec le serveur et le dossier de données", () => {
    expect(JSON.parse(configurationDuClient(windows))).toEqual({
      mcpServers: { "simulateur-independant-fr": { command: windows.executable, args: [windows.script, "--donnees", windows.donnees], env: { ELECTRON_RUN_AS_NODE: "1" } } }
    })
  })

  it("indique le fichier de configuration de Claude Desktop selon le système", () => {
    expect(configurationDeClaudeDesktop("win32")).toBe("%APPDATA%\\Claude\\claude_desktop_config.json")
    expect(configurationDeClaudeDesktop("darwin")).toBe("~/Library/Application Support/Claude/claude_desktop_config.json")
    expect(configurationDeClaudeDesktop("linux")).toBeNull()
  })

  it("donne la commande de vérification pour PowerShell, et pour les autres terminaux", () => {
    expect(commandeDeVerification(windows)).toBe('$env:ELECTRON_RUN_AS_NODE=1; & "C:\\Programmes\\Simulateur.exe" "C:\\Programmes\\resources\\mcp\\serveur-mcp.mjs" --donnees "C:\\Users\\a\\AppData\\Roaming\\Simulateur"')
    expect(commandeDeVerification({ ...windows, plateforme: "darwin" })).toMatch(/^ELECTRON_RUN_AS_NODE=1 "/)
  })
})

describe("installation classique ou version du Microsoft Store", () => {
  const installation = { executable: windows.executable, serveurLivre: windows.script, donnees: windows.donnees, plateforme: "win32" }
  const paquet = "C:\\Program Files\\WindowsApps\\Paquet_0.9.0.0_x64__abc\\app"

  it("donne l'exécutable et le serveur livré d'une installation classique", () => {
    expect(infosDeLInstallation({ ...installation, dossierLocalAppData: null })).toEqual(windows)
  })

  it("passe par l'alias d'exécution et la copie du serveur dans le dossier de données pour le Microsoft Store", () => {
    const store = infosDeLInstallation({ ...installation, executable: `${paquet}\\Simulateur.exe`, serveurLivre: `${paquet}\\resources\\mcp\\serveur-mcp.mjs`, dossierLocalAppData: "C:\\Users\\a\\AppData\\Local" })
    expect(store).toEqual({
      executable: `C:\\Users\\a\\AppData\\Local\\Microsoft\\WindowsApps\\${ALIAS_D_EXECUTION}`,
      script: "C:\\Users\\a\\AppData\\Roaming\\Simulateur\\mcp\\serveur-mcp.mjs",
      donnees: windows.donnees,
      plateforme: "win32",
      microsoftStore: true
    })
    // Le dossier du paquet change à chaque mise à jour : la configuration n'y renvoie jamais.
    expect(configurationDuClient(store)).not.toContain("Paquet_0.9.0.0")
    expect(JSON.parse(configurationDuClient(store)).mcpServers["simulateur-independant-fr"].env).toEqual({ ELECTRON_RUN_AS_NODE: "1" })
  })
})

describe("fichiers de la boîte aux propositions", () => {
  it("nomme un fichier par son horodatage, avec un suffixe nettoyé", () => {
    const nom = nomDUnePropositionEnAttente(new Date("2026-10-06T08:30:00.000Z"), "a/b..c-d")
    expect(nom).toBe("2026-10-06T08-30-00-000Z-abcd.json")
    expect(NOM_DE_PROPOSITION.test(nom)).toBe(true)
  })

  it("refuse un contenu qui n'est pas du JSON ou ne suit pas le format", () => {
    expect(lireUnePropositionEnAttente("{")).toBeNull()
    expect(lireUnePropositionEnAttente(JSON.stringify({ format: "simulateur-independant-fr/proposition", version: 2 }))).toBeNull()
  })
})

describe("même session pour l'application et le serveur", () => {
  const sessions: [string, SessionState][] = [["la simulation d'exemple", sessionExemple()], ...MONTAGES_TYPES.map((m): [string, SessionState] => [`le montage « ${m.titre} »`, sessionDUnMontage(m)])]
  it.each(sessions)("garde l'empreinte de %s après enregistrement et relecture", (_nom, session) => {
    const relue = lireLaSession(contenuDuFichier(session, "0.9.0")).safeState
    expect(empreinteDeLaSession(relue)).toBe(empreinteDeLaSession(session))
  })
})
