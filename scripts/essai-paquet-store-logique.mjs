// scripts/essai-paquet-store-logique.mjs
// La partie pure de `npm run essai:store` (scripts/essai-paquet-store.mjs) : lecture des arguments, nom de famille du
// paquet, choix du signtool, garde-fou avant l'installation, vérification du paquet installé, et entrée du serveur MCP
// dans la configuration de Claude Desktop. Rien ici ne lit le disque ni ne lance de commande : tout est testé dans
// scripts/essai-paquet-store.test.mjs.

import { createHash } from "node:crypto"
import { configurationDeClaudeDesktop, entreeDuServeur, infosDeLInstallation, NOM_DU_SERVEUR_MCP } from "../src/lib/configuration-mcp.ts"

// --- Arguments ---------------------------------------------------------------------------------------------------

export const COMMANDES = ["installer", "verifier", "etat", "nettoyer"]

/** Les options admises par chaque commande. */
const OPTIONS_PERMISES = {
  installer: ["--paquet", "--nouvel-utilisateur", "--claude-desktop"],
  verifier: [],
  etat: [],
  nettoyer: ["--claude-desktop"]
}

/**
 * Les arguments de `npm run essai:store -- <commande> [options]`. Renvoie `{ commande, paquet, nouvelUtilisateur,
 * claudeDesktop }`, ou `{ erreur }` si une commande ou une option est inconnue ou mal placée.
 */
export function lireLesArguments(argv) {
  const resultat = { commande: "installer", paquet: null, nouvelUtilisateur: false, claudeDesktop: false }
  const options = []
  for (let i = 0; i < argv.length; i++) {
    const argument = argv[i]
    if (!argument.startsWith("--")) {
      if (i > 0 || !COMMANDES.includes(argument)) return { erreur: `Commande inconnue : « ${argument} » (attendu : ${COMMANDES.join(", ")}).` }
      resultat.commande = argument
      continue
    }
    options.push(argument)
    if (argument === "--paquet") {
      resultat.paquet = argv[++i] ?? null
      if (!resultat.paquet) return { erreur: "--paquet attend le chemin d'un fichier .appx." }
    } else if (argument === "--nouvel-utilisateur") resultat.nouvelUtilisateur = true
    else if (argument === "--claude-desktop") resultat.claudeDesktop = true
    else return { erreur: `Option inconnue : « ${argument} ».` }
  }
  const refusee = options.find(option => !OPTIONS_PERMISES[resultat.commande].includes(option))
  if (refusee) return { erreur: `L'option ${refusee} ne s'emploie pas avec « ${resultat.commande} ».` }
  return resultat
}

// --- Identité et version du paquet ---------------------------------------------------------------------------------

/** Alphabet du hachage de l'éditeur dans le nom de famille d'un paquet (base 32 sans i, l, o, u). */
const ALPHABET_DE_L_EDITEUR = "0123456789abcdefghjkmnpqrstvwxyz"

/**
 * L'identifiant de l'éditeur (13 caractères) que Windows ajoute au nom du paquet : les 8 premiers octets du SHA-256 du
 * champ Publisher en UTF-16LE, complétés d'un bit nul, lus par groupes de 5 bits.
 */
export function identifiantDeLEditeur(publisher) {
  const octets = createHash("sha256").update(Buffer.from(publisher, "utf16le")).digest().subarray(0, 8)
  const bits = [...octets].map(octet => octet.toString(2).padStart(8, "0")).join("") + "0"
  return Array.from({ length: 13 }, (_, i) => ALPHABET_DE_L_EDITEUR[Number.parseInt(bits.slice(i * 5, i * 5 + 5), 2)]).join("")
}

/** Le nom de famille du paquet (`<Name>_<identifiant de l'éditeur>`), qui nomme son dossier dans %LOCALAPPDATA%\Packages. */
export function nomDeFamilleDuPaquet({ identityName, publisher }) {
  return `${identityName}_${identifiantDeLEditeur(publisher)}`
}

/** La version du paquet telle qu'electron-builder l'écrit dans le manifeste : 0.11.0 donne 0.11.0.0. */
export function versionDuPaquet(version) {
  const [majeure, mineure, correctif] = version.split(".").map(partie => Number.parseInt(partie, 10) || 0)
  return `${majeure}.${mineure ?? 0}.${correctif ?? 0}.0`
}

/** Compare deux versions numériques (« 10.0.22621.0 », « 0.11.0.0 ») : négatif, nul ou positif. */
export function comparerLesVersions(a, b) {
  const pa = a.split(".").map(Number)
  const pb = b.split(".").map(Number)
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const ecart = (pa[i] ?? 0) - (pb[i] ?? 0)
    if (ecart !== 0) return ecart
  }
  return 0
}

/** Le nom du paquet construit dans dist/, d'après le modèle `appx.artifactName` d'electron-builder.json. */
export function nomDuPaquetConstruit(modele, version) {
  return modele.replace("${version}", version).replace("${arch}", "x64").replace("${ext}", "appx")
}

// Guillemets doubles ou simples : electron-builder écrit l'éditeur entre guillemets simples (Publisher='CN=…').
const attribut = (balise, nom) => {
  const trouve = new RegExp(`\\s${nom}=(?:"([^"]*)"|'([^']*)')`).exec(balise)
  return trouve ? (trouve[1] ?? trouve[2]) : null
}

/** Nom, éditeur et version déclarés par l'élément `<Identity>` d'un AppxManifest.xml ; `null` s'il manque. */
export function identiteDuManifeste(xml) {
  const balise = /<Identity\b[^>]*>/.exec(xml)?.[0]
  if (!balise) return null
  const identite = { nom: attribut(balise, "Name"), editeur: attribut(balise, "Publisher"), version: attribut(balise, "Version") }
  return Object.values(identite).every(Boolean) ? { ...identite, editeur: identite.editeur.replaceAll("&quot;", '"').replaceAll("&apos;", "'").replaceAll("&amp;", "&") } : null
}

// --- signtool ----------------------------------------------------------------------------------------------------

/** Version minimale du SDK Windows dont le signtool signe un paquet .appx (celui d'electron-builder est trop ancien). */
export const VERSION_MINIMALE_DU_SDK = "10.0.22621.0"

/** Le paquet NuGet officiel qui contient un signtool récent, à version fixée. */
export const OUTILS_NUGET = Object.freeze({
  nom: "Microsoft.Windows.SDK.BuildTools",
  version: "10.0.26100.4188",
  signtool: String.raw`bin\10.0.26100.0\x64\signtool.exe`
})

/**
 * Parmi des chemins `…\Windows Kits\10\bin\<version>\x64\signtool.exe`, le signtool du SDK le plus récent, au moins
 * VERSION_MINIMALE_DU_SDK ; `null` s'il n'y en a pas.
 */
export function choisirLeSigntool(candidats) {
  const versions = candidats
    .map(chemin => ({ chemin, version: /\\bin\\(\d+\.\d+\.\d+\.\d+)\\x64\\signtool\.exe$/i.exec(chemin)?.[1] }))
    .filter(({ version }) => version && comparerLesVersions(version, VERSION_MINIMALE_DU_SDK) >= 0)
    .sort((a, b) => comparerLesVersions(b.version, a.version))
  return versions[0]?.chemin ?? null
}

/** Vrai si `Get-AuthenticodeSignature` dit la signature valide et faite par Microsoft. */
export function signatureDeMicrosoft({ statut, signataire }) {
  return statut === "Valid" && /(^|,\s*)O=Microsoft Corporation(,|$)/.test(signataire ?? "")
}

// --- Garde-fou et vérification de l'installation ------------------------------------------------------------------

/** Les signatures d'une copie d'essai : signée par notre certificat (Developer), ou enregistrée depuis un dossier (None). */
const SIGNATURES_D_ESSAI = ["Developer", "None"]

/**
 * Que faire avant d'installer la copie de la version `version` (forme du manifeste), vu les paquets de même nom déjà
 * installés (`Get-AppxPackage` : PackageFullName, Version, SignatureKind). Renvoie `{ action, paquets?, raison? }` :
 * `installer` (rien d'installé, ou une copie d'essai plus ancienne, mise à jour en place), `remplacer` (copie d'essai
 * de même version ou plus récente, à désinstaller d'abord), ou `refuser`.
 */
export function decisionAvantInstallation(installes, version) {
  const store = installes.find(paquet => paquet.SignatureKind === "Store")
  if (store) {
    return {
      action: "refuser",
      raison: `La version du Microsoft Store (${store.Version}) est installée : l'essai la remplacerait. Désinstallez-la d'abord (Paramètres > Applications), puis relancez l'essai.`
    }
  }
  const autre = installes.find(paquet => !SIGNATURES_D_ESSAI.includes(paquet.SignatureKind))
  if (autre) return { action: "refuser", raison: `Un paquet ${autre.PackageFullName} est installé avec une signature « ${autre.SignatureKind} » : ce n'est pas une copie d'essai, il n'est pas touché.` }
  const aRemplacer = installes.filter(paquet => comparerLesVersions(paquet.Version, version) >= 0)
  return aRemplacer.length > 0 ? { action: "remplacer", paquets: aRemplacer } : { action: "installer" }
}

/** Les écarts entre le paquet installé et ce qu'installe le Store : emplacement, signature, version. */
export function ecartsDeLInstallation(installe, version, dossierWindowsApps = "C:\\Program Files\\WindowsApps\\") {
  if (!installe) return ["le paquet n'apparaît pas dans Get-AppxPackage."]
  const ecarts = []
  if (!installe.InstallLocation?.toLowerCase().startsWith(dossierWindowsApps.toLowerCase())) ecarts.push(`emplacement ${installe.InstallLocation} hors de ${dossierWindowsApps}`)
  if (installe.SignatureKind !== "Developer") ecarts.push(`signature « ${installe.SignatureKind} » au lieu de « Developer »`)
  if (installe.Version !== version) ecarts.push(`version ${installe.Version} au lieu de ${version}`)
  return ecarts
}

/** La version annoncée par le serveur MCP au démarrage (« Serveur MCP du simulateur 0.11.0 prêt ; … »), ou `null`. */
export function versionDuServeurPret(sortie) {
  return /Serveur MCP du simulateur (\S+) prêt/.exec(sortie)?.[1] ?? null
}

/** Vrai si l'un de ces exécutables est Claude Desktop (en paquet ou installé classiquement) et non Claude Code. */
export function claudeDesktopEstOuvert(chemins) {
  return chemins.some(chemin => /\\WindowsApps\\Claude_[^\\]+\\|\\AnthropicClaude\\/i.test(chemin ?? ""))
}

// --- Serveur MCP et Claude Desktop --------------------------------------------------------------------------------

/**
 * L'entrée `mcpServers` que donne la version du Microsoft Store (src/lib/configuration-mcp.ts) : alias d'exécution,
 * copie du serveur dans le dossier de données, tels que les voit un process du paquet.
 */
export function entreeDeLaVersionDuStore({ appData, localAppData, dossierDeDonnees }) {
  const donnees = `${appData}\\${dossierDeDonnees}`
  const infos = infosDeLInstallation({ executable: "", serveurLivre: "", donnees, plateforme: "win32", dossierLocalAppData: localAppData })
  return entreeDuServeur(infos)
}

/**
 * Le fichier de configuration de Claude Desktop sous Windows (modèles de src/lib/configuration-mcp.ts), et son mode
 * d'installation. `paquetsClaude` : les dossiers `Claude_…` de %LOCALAPPDATA%\Packages ; `existe` dit si un chemin
 * existe. Le fichier existant l'emporte (en paquet d'abord) ; à défaut, le dossier de l'installation présente.
 * Renvoie `{ chemin, mode: "paquet" | "classique", existe }`, ou `null` si Claude Desktop n'a pas été trouvé.
 */
export function fichierDeClaudeDesktop({ appData, localAppData, paquetsClaude, existe }) {
  const modeles = configurationDeClaudeDesktop("win32")
  const developper = modele => modele.replace("%APPDATA%", appData).replace("%LOCALAPPDATA%", localAppData)
  const paquet = paquetsClaude.find(nom => /^Claude_[a-z0-9]{13}$/.test(nom))
  const candidats = [
    ...(paquet ? [{ chemin: developper(modeles.enPaquet.replace("Claude_<identifiant>", paquet)), mode: "paquet" }] : []),
    { chemin: developper(modeles.habituel), mode: "classique" }
  ]
  const present = candidats.find(({ chemin }) => existe(chemin))
  if (present) return { ...present, existe: true }
  const dossier = chemin => chemin.slice(0, chemin.lastIndexOf("\\"))
  const installation = candidats.find(({ chemin, mode }) => mode === "paquet" || existe(dossier(chemin)))
  return installation ? { ...installation, existe: false } : null
}

const egales = (a, b) => JSON.stringify(a) === JSON.stringify(b)

/** Le texte du fichier lu comme un objet JSON ; erreur claire s'il ne l'est pas (le fichier n'est alors pas touché). */
function lireLaConfiguration(texte) {
  if (texte.trim() === "") return {}
  let configuration
  try {
    configuration = JSON.parse(texte)
  } catch (erreur) {
    throw new Error(`Configuration de Claude Desktop illisible (JSON invalide : ${erreur.message}) : le fichier n'est pas modifié.`, { cause: erreur })
  }
  if (configuration === null || typeof configuration !== "object" || Array.isArray(configuration)) {
    throw new Error("Configuration de Claude Desktop inattendue (ce n'est pas un objet JSON) : le fichier n'est pas modifié.")
  }
  return configuration
}

const ecrire = (configuration, texteDOrigine) => JSON.stringify(configuration, null, 2) + (texteDOrigine.endsWith("\n") ? "\n" : "")

/** Où en est l'entrée du simulateur dans la configuration : `absente`, `identique`, `differente` ou `illisible`. */
export function etatDeLEntree(texte, entree) {
  try {
    const actuelle = lireLaConfiguration(texte).mcpServers?.[NOM_DU_SERVEUR_MCP]
    if (actuelle === undefined) return "absente"
    return egales(actuelle, entree) ? "identique" : "differente"
  } catch {
    return "illisible"
  }
}

/**
 * Ajoute l'entrée du simulateur dans `mcpServers`, sans toucher au reste (`preferences`…). Une rubrique `mcpServers`
 * absente est placée en tête, comme le bloc à insérer de la fenêtre « Utiliser avec une IA ». Renvoie
 * `{ resultat: "ajoutee" | "identique" | "differente", texte }` ; `texte` n'est donné que pour « ajoutee ».
 * JSON invalide : erreur.
 */
export function ajouterLEntree(texte, entree) {
  const configuration = lireLaConfiguration(texte)
  const serveurs = configuration.mcpServers ?? {}
  const actuelle = serveurs[NOM_DU_SERVEUR_MCP]
  if (actuelle !== undefined) return { resultat: egales(actuelle, entree) ? "identique" : "differente" }
  const mcpServers = { ...serveurs, [NOM_DU_SERVEUR_MCP]: entree }
  // L'ordre des clés suit leur création : une rubrique existante garde sa place, une nouvelle vient en tête.
  const nouvelle = "mcpServers" in configuration ? { ...configuration, mcpServers } : { mcpServers, ...configuration }
  return { resultat: "ajoutee", texte: ecrire(nouvelle, texte) }
}

/**
 * Retire l'entrée du simulateur si elle est celle de la version du Store (`entree`) ; une rubrique `mcpServers` vidée
 * est retirée aussi. Renvoie `{ resultat: "retiree" | "absente" | "differente", texte }` ; `texte` n'est donné que pour
 * « retiree ». Une entrée différente (installation classique, par exemple) n'est pas touchée. JSON invalide : erreur.
 */
export function retirerLEntree(texte, entree) {
  const configuration = lireLaConfiguration(texte)
  const actuelle = configuration.mcpServers?.[NOM_DU_SERVEUR_MCP]
  if (actuelle === undefined) return { resultat: "absente" }
  if (!egales(actuelle, entree)) return { resultat: "differente" }
  const nouvelle = { ...configuration, mcpServers: { ...configuration.mcpServers } }
  delete nouvelle.mcpServers[NOM_DU_SERVEUR_MCP]
  if (Object.keys(nouvelle.mcpServers).length === 0) delete nouvelle.mcpServers
  return { resultat: "retiree", texte: ecrire(nouvelle, texte) }
}

/** Le chemin de la copie de sauvegarde d'un fichier avant modification : `<fichier>.avant-essai-store-<horodatage>`. */
export function cheminDeSauvegarde(chemin, date) {
  return `${chemin}.avant-essai-store-${date.toISOString().slice(0, 19).replaceAll(":", "-")}`
}
