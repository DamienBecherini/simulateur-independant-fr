// scripts/essai-paquet-store.test.mjs
// La partie pure de `npm run essai:store` : ce que le script décide avant de toucher au paquet, aux certificats ou à la
// configuration de Claude Desktop. Les appels à Windows (Appx, certificats, signtool) s'essaient sur un vrai poste
// (documentation/microsoft-store/publier-sur-le-store.md, étape 2).

import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"
import {
  ajouterLEntree,
  cheminDeSauvegarde,
  choisirLeSigntool,
  classerLesProcessDeLApplication,
  claudeDesktopEstOuvert,
  clientQuiALance,
  comparerLesVersions,
  decisionAvantInstallation,
  ecartsDeLInstallation,
  entreeDeLaVersionDuStore,
  etatDeLEntree,
  fichierDeClaudeDesktop,
  identiteDuManifeste,
  lireLesArguments,
  messageDApplicationOuverte,
  nomDeFamilleDuPaquet,
  nomDuPaquetConstruit,
  retirerLEntree,
  serveursParClient,
  signatureDeMicrosoft,
  versionDuPaquet,
  versionDuServeurPret
} from "./essai-paquet-store-logique.mjs"
import { lireLIdentite } from "./identite-store.mjs"

const lireJson = chemin => JSON.parse(readFileSync(new URL(`../${chemin}`, import.meta.url), "utf-8"))

const APPDATA = String.raw`C:\Users\Camille\AppData\Roaming`
const LOCALAPPDATA = String.raw`C:\Users\Camille\AppData\Local`
const entree = entreeDeLaVersionDuStore({ appData: APPDATA, localAppData: LOCALAPPDATA, dossierDeDonnees: "simulateur-independant-fr" })

describe("arguments de npm run essai:store", () => {
  it("installe par défaut, avec les options de chaque commande", () => {
    expect(lireLesArguments([])).toEqual({ commande: "installer", paquet: null, nouvelUtilisateur: false, claudeDesktop: false, arreterLesServeursMcp: false })
    expect(lireLesArguments(["--paquet", "a.appx", "--nouvel-utilisateur", "--claude-desktop"])).toEqual({
      commande: "installer",
      paquet: "a.appx",
      nouvelUtilisateur: true,
      claudeDesktop: true,
      arreterLesServeursMcp: false
    })
    expect(lireLesArguments(["nettoyer", "--claude-desktop"])).toMatchObject({ commande: "nettoyer", claudeDesktop: true })
    expect(lireLesArguments(["nettoyer", "--arreter-les-serveurs-mcp"])).toMatchObject({ commande: "nettoyer", arreterLesServeursMcp: true })
    expect(lireLesArguments(["installer", "--arreter-les-serveurs-mcp"])).toMatchObject({ arreterLesServeursMcp: true })
    expect(lireLesArguments(["etat"])).toMatchObject({ commande: "etat" })
  })

  it("refuse une commande ou une option inconnue, mal placée ou incomplète", () => {
    expect(lireLesArguments(["desinstaller"]).erreur).toMatch(/Commande inconnue/)
    expect(lireLesArguments(["--paquet", "a.appx", "verifier"]).erreur).toMatch(/Commande inconnue/)
    expect(lireLesArguments(["--force"]).erreur).toMatch(/Option inconnue/)
    expect(lireLesArguments(["--paquet"]).erreur).toMatch(/--paquet attend/)
    expect(lireLesArguments(["verifier", "--claude-desktop"]).erreur).toMatch(/--claude-desktop ne s'emploie pas avec « verifier »/)
    expect(lireLesArguments(["nettoyer", "--nouvel-utilisateur"]).erreur).toMatch(/--nouvel-utilisateur/)
    expect(lireLesArguments(["etat", "--arreter-les-serveurs-mcp"]).erreur).toMatch(/--arreter-les-serveurs-mcp ne s'emploie pas avec « etat »/)
  })
})

describe("identité et version du paquet", () => {
  it("donne le nom de famille du paquet relevé dans Partner Center", () => {
    const { identite } = lireLIdentite(lireJson("build/store/identite.json"))
    // Valeur relevée le 2026-10-11 (publier-sur-le-store.md) : le calcul doit la retrouver depuis l'identité.
    if (identite.identityName === "DamienBECHERINI.SimulateurIndpendantFR") expect(nomDeFamilleDuPaquet(identite)).toBe("DamienBECHERINI.SimulateurIndpendantFR_r47q8w9e2mv8c")
    expect(nomDeFamilleDuPaquet({ identityName: "DamienBECHERINI.SimulateurIndpendantFR", publisher: "CN=82BAFE86-DEBC-4123-9C53-FF6F4E086825" })).toBe(
      "DamienBECHERINI.SimulateurIndpendantFR_r47q8w9e2mv8c"
    )
    expect(nomDeFamilleDuPaquet({ identityName: "Essai.SimulateurIndependantFR", publisher: "CN=Essai" })).toMatch(/^Essai\.SimulateurIndependantFR_[0-9a-hjkmnp-tv-z]{13}$/)
  })

  it("écrit la version comme le manifeste, et compare les versions numériquement", () => {
    expect(versionDuPaquet("0.11.0")).toBe("0.11.0.0")
    expect(versionDuPaquet("1.2.3-beta.1")).toBe("1.2.3.0")
    expect(comparerLesVersions("0.10.0.0", "0.9.0.0")).toBeGreaterThan(0)
    expect(comparerLesVersions("0.11.0.0", "0.11.0")).toBe(0)
    expect(comparerLesVersions("10.0.19041.0", "10.0.22621.0")).toBeLessThan(0)
  })

  it("trouve le nom du paquet construit dans dist/", () => {
    const { appx } = lireJson("electron-builder.json")
    expect(nomDuPaquetConstruit(appx.artifactName, "0.11.0")).toBe("Simulateur-Independant-FR-0.11.0-store-x64.appx")
  })

  it("lit l'identité dans le manifeste du paquet", () => {
    const xml = `<?xml version="1.0"?><Package><Identity Name="Essai.SimulateurIndependantFR" ProcessorArchitecture="x64" Publisher="CN=Essai, O=&quot;A &amp; B&quot;" Version="0.11.0.0" /></Package>`
    expect(identiteDuManifeste(xml)).toEqual({ nom: "Essai.SimulateurIndependantFR", editeur: 'CN=Essai, O="A & B"', version: "0.11.0.0" })
    // Comme dans le manifeste écrit par electron-builder : l'éditeur entre guillemets simples, sur plusieurs lignes.
    const manifesteDElectronBuilder = `<Package>\n  <Identity Name="DamienBECHERINI.SimulateurIndpendantFR"\n    ProcessorArchitecture="x64"\n    Publisher='CN=82BAFE86-DEBC-4123-9C53-FF6F4E086825'\n    Version="0.11.0.0" />\n</Package>`
    expect(identiteDuManifeste(manifesteDElectronBuilder)).toEqual({ nom: "DamienBECHERINI.SimulateurIndpendantFR", editeur: "CN=82BAFE86-DEBC-4123-9C53-FF6F4E086825", version: "0.11.0.0" })
    expect(identiteDuManifeste("<Package><Identity Name='x' /></Package>")).toBeNull()
    expect(identiteDuManifeste("<Package />")).toBeNull()
  })
})

describe("signtool", () => {
  const sdk = version => [String.raw`C:\Program Files (x86)\Windows Kits\10\bin`, version, "x64", "signtool.exe"].join("\\")

  it("prend le SDK Windows le plus récent, à partir de 10.0.22621", () => {
    expect(choisirLeSigntool([sdk("10.0.22621.0"), sdk("10.0.26100.0"), sdk("10.0.19041.0")])).toBe(sdk("10.0.26100.0"))
    expect(choisirLeSigntool([sdk("10.0.22621.0")])).toBe(sdk("10.0.22621.0"))
  })

  it("écarte un SDK trop ancien et ce qui n'est pas un signtool x64 d'un SDK", () => {
    expect(choisirLeSigntool([sdk("10.0.19041.0"), sdk("10.0.17763.0")])).toBeNull()
    expect(choisirLeSigntool([String.raw`C:\Program Files (x86)\Windows Kits\10\bin\10.0.26100.0\x86\signtool.exe`, String.raw`C:\outils\signtool.exe`])).toBeNull()
    expect(choisirLeSigntool([])).toBeNull()
  })

  it("n'accepte qu'une signature Authenticode valide de Microsoft", () => {
    const microsoft = "CN=Microsoft Corporation, O=Microsoft Corporation, L=Redmond, S=Washington, C=US"
    expect(signatureDeMicrosoft({ statut: "Valid", signataire: microsoft })).toBe(true)
    expect(signatureDeMicrosoft({ statut: "HashMismatch", signataire: microsoft })).toBe(false)
    expect(signatureDeMicrosoft({ statut: "NotSigned", signataire: null })).toBe(false)
    expect(signatureDeMicrosoft({ statut: "Valid", signataire: "CN=Microsoft Corporation, O=Microsoft Corporation Imitée" })).toBe(false)
  })
})

describe("garde-fou avant l'installation", () => {
  const paquet = (Version, SignatureKind) => ({ PackageFullName: `Nom_${Version}_x64__abc`, Version, SignatureKind })

  it("installe s'il n'y a rien, ou par-dessus une copie d'essai plus ancienne", () => {
    expect(decisionAvantInstallation([], "0.11.0.0")).toEqual({ action: "installer" })
    expect(decisionAvantInstallation([paquet("0.10.0.0", "Developer")], "0.11.0.0")).toEqual({ action: "installer" })
  })

  it("remplace une copie d'essai de même version ou plus récente", () => {
    const meme = paquet("0.11.0.0", "Developer")
    const enregistree = paquet("0.12.0.0", "None")
    expect(decisionAvantInstallation([meme], "0.11.0.0")).toEqual({ action: "remplacer", paquets: [meme] })
    expect(decisionAvantInstallation([enregistree], "0.11.0.0")).toEqual({ action: "remplacer", paquets: [enregistree] })
  })

  it("refuse de toucher à la version du Store ou à un paquet d'une autre origine", () => {
    expect(decisionAvantInstallation([paquet("0.10.0.0", "Developer"), paquet("0.11.0.0", "Store")], "0.11.0.0")).toMatchObject({ action: "refuser", raison: expect.stringMatching(/Microsoft Store.*Désinstallez-la/) })
    expect(decisionAvantInstallation([paquet("0.11.0.0", "Enterprise")], "0.11.0.0")).toMatchObject({ action: "refuser", raison: expect.stringMatching(/Enterprise/) })
  })

  it("vérifie l'installation : sous WindowsApps, signature d'essai, version attendue", () => {
    const installe = { InstallLocation: String.raw`C:\Program Files\WindowsApps\Nom_0.11.0.0_x64__abc`, SignatureKind: "Developer", Version: "0.11.0.0" }
    expect(ecartsDeLInstallation(installe, "0.11.0.0")).toEqual([])
    expect(ecartsDeLInstallation({ InstallLocation: String.raw`D:\essai\paquet`, SignatureKind: "None", Version: "0.10.0.0" }, "0.11.0.0")).toHaveLength(3)
    expect(ecartsDeLInstallation(null, "0.11.0.0")).toEqual(["le paquet n'apparaît pas dans Get-AppxPackage."])
  })
})

describe("serveur MCP et Claude Desktop", () => {
  it("lance le serveur comme la configuration de la version du Store (ADR 013)", () => {
    expect(entree).toEqual({
      command: String.raw`C:\Users\Camille\AppData\Local\Microsoft\WindowsApps\simulateur-independant-fr.exe`,
      args: [String.raw`C:\Users\Camille\AppData\Roaming\simulateur-independant-fr\mcp\serveur-mcp.mjs`, "--donnees", String.raw`C:\Users\Camille\AppData\Roaming\simulateur-independant-fr`],
      env: { ELECTRON_RUN_AS_NODE: "1" }
    })
  })

  it("lit la version annoncée par le serveur prêt", () => {
    expect(versionDuServeurPret("Serveur MCP du simulateur 0.11.0 prêt ; données lues dans C:\\…\n")).toBe("0.11.0")
    expect(versionDuServeurPret("Error: Cannot find module")).toBeNull()
  })

  it("reconnaît Claude Desktop ouvert, pas Claude Code", () => {
    expect(claudeDesktopEstOuvert([String.raw`C:\Program Files\WindowsApps\Claude_1.0.0.0_x64__pzs8sxrjxfjjc\app\claude.exe`])).toBe(true)
    expect(claudeDesktopEstOuvert([String.raw`C:\Users\Camille\AppData\Local\AnthropicClaude\app-1.0.0\claude.exe`])).toBe(true)
    expect(claudeDesktopEstOuvert([String.raw`C:\Users\Camille\.local\bin\claude.exe`, null])).toBe(false)
  })

  describe("fichier de configuration de Claude Desktop", () => {
    const enPaquet = String.raw`C:\Users\Camille\AppData\Local\Packages\Claude_pzs8sxrjxfjjc\LocalCache\Roaming\Claude\claude_desktop_config.json`
    const classique = String.raw`C:\Users\Camille\AppData\Roaming\Claude\claude_desktop_config.json`
    const trouver = (paquetsClaude, existants) =>
      fichierDeClaudeDesktop({ appData: APPDATA, localAppData: LOCALAPPDATA, paquetsClaude, existe: chemin => existants.includes(chemin) })

    it("est dans le dossier du paquet quand Claude Desktop est un paquet MSIX", () => {
      expect(trouver(["Claude_pzs8sxrjxfjjc"], [enPaquet])).toEqual({ chemin: enPaquet, mode: "paquet", existe: true })
      expect(trouver(["Claude_pzs8sxrjxfjjc"], [])).toEqual({ chemin: enPaquet, mode: "paquet", existe: false })
    })

    it("est dans %APPDATA%\\Claude pour une installation classique, ou s'il y existe déjà", () => {
      expect(trouver([], [classique])).toEqual({ chemin: classique, mode: "classique", existe: true })
      expect(trouver(["Claude_pzs8sxrjxfjjc"], [classique])).toEqual({ chemin: classique, mode: "classique", existe: true })
      expect(trouver(["ClaudeAutre_x"], [String.raw`C:\Users\Camille\AppData\Roaming\Claude`])).toEqual({ chemin: classique, mode: "classique", existe: false })
    })

    it("n'existe pas sans Claude Desktop", () => {
      expect(trouver([], [])).toBeNull()
    })
  })

  describe("entrée du simulateur dans la configuration", () => {
    const avecPreferences = `{\n  "preferences": {\n    "sidebarMode": "chat"\n  }\n}\n`

    it("s'ajoute en tête d'un fichier qui a des préférences, sans toucher au reste", () => {
      const { resultat, texte } = ajouterLEntree(avecPreferences, entree)
      expect(resultat).toBe("ajoutee")
      expect(Object.keys(JSON.parse(texte))).toEqual(["mcpServers", "preferences"])
      expect(JSON.parse(texte)).toEqual({ mcpServers: { "simulateur-independant-fr": entree }, preferences: { sidebarMode: "chat" } })
      expect(texte.endsWith("}\n")).toBe(true)
      expect(etatDeLEntree(texte, entree)).toBe("identique")
    })

    it("complète une rubrique mcpServers existante, à sa place", () => {
      const autre = JSON.stringify({ preferences: {}, mcpServers: { autre: { command: "x" } } })
      const { texte } = ajouterLEntree(autre, entree)
      expect(Object.keys(JSON.parse(texte))).toEqual(["preferences", "mcpServers"])
      expect(Object.keys(JSON.parse(texte).mcpServers)).toEqual(["autre", "simulateur-independant-fr"])
    })

    it("remplit un fichier vide", () => {
      expect(JSON.parse(ajouterLEntree("  \n", entree).texte)).toEqual({ mcpServers: { "simulateur-independant-fr": entree } })
      expect(etatDeLEntree("", entree)).toBe("absente")
    })

    it("ne change rien si l'entrée est déjà là, identique ou différente", () => {
      const { texte } = ajouterLEntree(avecPreferences, entree)
      expect(ajouterLEntree(texte, entree)).toEqual({ resultat: "identique" })
      const classique = { ...entree, command: String.raw`C:\Users\Camille\AppData\Local\Programs\simulateur-independant-fr\Simulateur Indépendant FR.exe` }
      expect(ajouterLEntree(texte, classique)).toEqual({ resultat: "differente" })
      expect(etatDeLEntree(texte, classique)).toBe("differente")
    })

    it("refuse un JSON invalide ou qui n'est pas un objet", () => {
      expect(() => ajouterLEntree(`{ "preferences": { }, }`, entree)).toThrow(/illisible.*n'est pas modifié/)
      expect(() => ajouterLEntree("[]", entree)).toThrow(/pas un objet JSON/)
      expect(() => retirerLEntree("{", entree)).toThrow(/illisible/)
      expect(etatDeLEntree("{", entree)).toBe("illisible")
    })

    it("se retire si elle est celle de la version du Store, avec la rubrique si elle devient vide", () => {
      const { texte } = ajouterLEntree(avecPreferences, entree)
      expect(retirerLEntree(texte, entree)).toEqual({ resultat: "retiree", texte: avecPreferences })
      const avecAutre = ajouterLEntree(JSON.stringify({ mcpServers: { autre: { command: "x" } } }), entree).texte
      expect(JSON.parse(retirerLEntree(avecAutre, entree).texte)).toEqual({ mcpServers: { autre: { command: "x" } } })
    })

    it("ne retire ni une entrée absente ni une entrée différente", () => {
      expect(retirerLEntree(avecPreferences, entree)).toEqual({ resultat: "absente" })
      const { texte } = ajouterLEntree(avecPreferences, { ...entree, args: [] })
      expect(retirerLEntree(texte, entree)).toEqual({ resultat: "differente" })
    })

    it("se sauvegarde avant modification sous un nom horodaté", () => {
      expect(cheminDeSauvegarde(String.raw`C:\x\claude_desktop_config.json`, new Date("2026-10-13T08:05:09.123Z"))).toBe(String.raw`C:\x\claude_desktop_config.json.avant-essai-store-2026-10-13T08-05-09`)
    })
  })
})

describe("application ouverte : fenêtre ou serveurs MCP", () => {
  const EXE = "Simulateur Indépendant FR.exe"
  const DANS_WINDOWSAPPS = String.raw`C:\Program Files\WindowsApps\DamienBECHERINI.SimulateurIndpendantFR_0.11.0.0_x64__r47q8w9e2mv8c\Simulateur Indépendant FR.exe`
  const CLASSIQUE = String.raw`C:\Users\Camille\AppData\Local\Programs\simulateur-independant-fr\Simulateur Indépendant FR.exe`
  const CLAUDE_CODE = String.raw`C:\Users\Camille\.local\bin\claude.exe`
  const CLAUDE_DESKTOP_PAQUET = String.raw`C:\Program Files\WindowsApps\Claude_1.2.3.0_x64__pzs8sxrjxfjjc\app\claude.exe`
  const CLAUDE_DESKTOP_CLASSIQUE = String.raw`C:\Users\Camille\AppData\Local\AnthropicClaude\app-1.2.3\claude.exe`
  const serveur = (id, parent, executable = DANS_WINDOWSAPPS) => ({ id, parent, executable, nom: EXE, ligne: `"${executable}" "C:\\x\\mcp\\serveur-mcp.mjs" --donnees "C:\\x"` })
  const cmd = (id, parent) => ({ id, parent, executable: String.raw`C:\Windows\System32\cmd.exe`, nom: "cmd.exe", ligne: "cmd.exe /c ..." })
  const claude = (id, parent, executable) => ({ id, parent, executable, nom: "claude.exe", ligne: "claude" })
  const fenetre = (id, parent = 1) => ({ id, parent, executable: DANS_WINDOWSAPPS, nom: EXE, ligne: `"${DANS_WINDOWSAPPS}"` })

  it("ne voit rien quand l'application n'est pas lancée", () => {
    expect(classerLesProcessDeLApplication([cmd(10, 1), claude(11, 10, CLAUDE_CODE)], EXE)).toEqual({ fenetre: [], serveursMcp: [] })
  })

  it("distingue la fenêtre (et ses process fils) des serveurs MCP", () => {
    const tous = [fenetre(20), { ...fenetre(21, 20), ligne: `"${DANS_WINDOWSAPPS}" --type=renderer` }, claude(30, 1, CLAUDE_CODE), cmd(31, 30), serveur(32, 31)]
    expect(classerLesProcessDeLApplication(tous, EXE)).toEqual({ fenetre: [20, 21], serveursMcp: [{ id: 32, client: "Claude Code" }] })
  })

  it("retrouve le client en remontant les parents, Claude Code ou Claude Desktop", () => {
    const tous = [
      claude(30, 1, CLAUDE_CODE),
      cmd(31, 30),
      serveur(32, 31),
      claude(40, 1, CLAUDE_DESKTOP_PAQUET),
      serveur(41, 40),
      claude(50, 1, CLAUDE_DESKTOP_CLASSIQUE),
      cmd(51, 50),
      serveur(52, 51),
      claude(60, 1, ""),
      serveur(61, 60),
      cmd(70, 1),
      serveur(71, 70)
    ]
    const { serveursMcp } = classerLesProcessDeLApplication(tous, EXE)
    expect(serveursMcp.map(({ client }) => client)).toEqual(["Claude Code", "Claude Desktop", "Claude Desktop", "Claude Code ou Claude Desktop", null])
  })

  it("ne compte pas les serveurs d'une installation classique (hors WindowsApps)", () => {
    expect(classerLesProcessDeLApplication([claude(30, 1, CLAUDE_CODE), serveur(32, 30, CLASSIQUE)], EXE)).toEqual({ fenetre: [], serveursMcp: [] })
  })

  it("s'arrête sur un cycle de parents", () => {
    expect(clientQuiALance([cmd(1, 2), cmd(2, 1), serveur(3, 1)], 3)).toBeNull()
    expect(clientQuiALance([], 3)).toBeNull()
  })

  it("compte les serveurs par client", () => {
    expect(serveursParClient([{ id: 1, client: "Claude Code" }, { id: 2, client: "Claude Code" }, { id: 3, client: null }])).toBe("2 lancés par Claude Code, 1 lancé par un client inconnu")
  })

  describe("message", () => {
    const nom = "Simulateur Indépendant FR"
    const pourquoi = "de désinstaller la copie d'essai"

    it("ne dit rien si rien ne tourne", () => {
      expect(messageDApplicationOuverte({ fenetre: [], serveursMcp: [] }, nom, pourquoi, false)).toBeNull()
    })

    it("demande de fermer la fenêtre, même si des serveurs tournent aussi", () => {
      const message = messageDApplicationOuverte({ fenetre: [1], serveursMcp: [{ id: 2, client: null }] }, nom, pourquoi, true)
      expect(message).toBe(`L'application « ${nom} » est ouverte : fermez-la avant ${pourquoi}, puis relancez la commande.`)
    })

    it("nomme les serveurs MCP, leur client et l'option qui les arrête", () => {
      const message = messageDApplicationOuverte({ fenetre: [], serveursMcp: [{ id: 2, client: "Claude Code" }, { id: 3, client: "Claude Code" }] }, nom, pourquoi, false)
      expect(message).toContain("fenêtre de l'application « Simulateur Indépendant FR » est fermée")
      expect(message).toContain("2 serveurs MCP tournent encore (2 lancés par Claude Code)")
      expect(message).toContain("--arreter-les-serveurs-mcp")
      expect(message).not.toContain("fermez-la")
    })

    it("accorde au singulier", () => {
      expect(messageDApplicationOuverte({ fenetre: [], serveursMcp: [{ id: 2, client: "Claude Desktop" }] }, nom, pourquoi, false)).toContain("1 serveur MCP tourne encore (1 lancé par Claude Desktop) : il empêche")
    })

    it("laisse passer les serveurs MCP quand le script doit les arrêter", () => {
      expect(messageDApplicationOuverte({ fenetre: [], serveursMcp: [{ id: 2, client: null }] }, nom, pourquoi, true)).toBeNull()
    })
  })
})
