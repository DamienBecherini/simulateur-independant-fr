// scripts/essai-paquet-store.mjs
// `npm run essai:store -- [commande] [options]` : essaie le paquet du Microsoft Store installé comme le Store
// l'installe, sous C:\Program Files\WindowsApps, avant une soumission (voir documentation/microsoft-store/
// publier-sur-le-store.md, étape 2, et l'ADR 013). Windows seulement. La partie pure est dans
// scripts/essai-paquet-store-logique.mjs ; les cmdlets Appx et les certificats passent par PowerShell.
//
//   installer [--paquet <fichier.appx>] [--nouvel-utilisateur] [--claude-desktop]   (commande par défaut)
//       construit le paquet (sauf --paquet), en signe une copie avec un certificat d'essai approuvé sur ce PC,
//       l'installe et vérifie que le serveur MCP démarre par l'alias d'exécution.
//   verifier                       relance seulement la vérification du serveur MCP.
//   etat                           ce qui est installé, sans rien modifier.
//   nettoyer [--claude-desktop]    désinstalle la copie d'essai, retire le certificat, remet les données en place.

import { spawn, spawnSync } from "node:child_process"
import { copyFileSync, existsSync, lstatSync, mkdirSync, readdirSync, readFileSync, renameSync, rmSync, statSync, writeFileSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import {
  ajouterLEntree,
  cheminDeSauvegarde,
  choisirLeSigntool,
  claudeDesktopEstOuvert,
  decisionAvantInstallation,
  ecartsDeLInstallation,
  entreeDeLaVersionDuStore,
  etatDeLEntree,
  fichierDeClaudeDesktop,
  identiteDuManifeste,
  lireLesArguments,
  nomDeFamilleDuPaquet,
  nomDuPaquetConstruit,
  OUTILS_NUGET,
  retirerLEntree,
  signatureDeMicrosoft,
  versionDuPaquet,
  versionDuServeurPret
} from "./essai-paquet-store-logique.mjs"
import { erreursDeLIdentite, IDENTITE_D_ESSAI, lireLIdentite } from "./identite-store.mjs"

const racine = fileURLToPath(new URL("..", import.meta.url))
const lireJson = chemin => JSON.parse(readFileSync(path.join(racine, chemin), "utf-8"))

/** Nom donné au certificat d'essai dans le magasin de l'utilisateur : c'est par lui que le script le retrouve. */
const NOM_DU_CERTIFICAT = "Essai du paquet Simulateur Indépendant FR (npm run essai:store)"
const SECONDES_POUR_LA_COPIE_DU_SERVEUR = 90
const SECONDES_POUR_LE_SERVEUR = 30
/** Marque du message d'erreur d'un script PowerShell, dans sa sortie standard. */
const MARQUE_D_ERREUR = "ERREUR-ESSAI-STORE:"

/** Erreur à montrer telle quelle, sans pile : le script s'arrête avec un code de sortie non nul. */
class Refus extends Error {}

// --- Environnement ---------------------------------------------------------------------------------------------------

const paquetNpm = lireJson("package.json")
const { identite, complete } = lireLIdentite(lireJson("build/store/identite.json"), process.env)
const env = {
  appData: process.env.APPDATA,
  localAppData: process.env.LOCALAPPDATA,
  programFilesX86: process.env["ProgramFiles(x86)"] ?? String.raw`C:\Program Files (x86)`
}
const outils = path.join(env.localAppData ?? "", "simulateur-independant-fr-outils")
/** Copies signées et certificat exporté : supprimés par `nettoyer`. */
const dossierDeTravail = path.join(outils, "essai")
const donneesClassiques = path.join(env.appData ?? "", paquetNpm.name)
const donneesMisesDeCote = `${donneesClassiques}.classique`
const entreeDuStore = () => entreeDeLaVersionDuStore({ appData: env.appData, localAppData: env.localAppData, dossierDeDonnees: paquetNpm.name })
/** Noms des paquets que le script peut avoir installés : l'identité du Store et l'identité d'essai. */
const nomsDesPaquets = () => [...new Set([identite.identityName, IDENTITE_D_ESSAI.identityName].filter(Boolean))]

const etape = texte => console.log(`\n== ${texte}`)
const info = texte => console.log(`   ${texte}`)

// --- PowerShell --------------------------------------------------------------------------------------------------------

/**
 * Lance un script PowerShell (Windows PowerShell 5.1, celui des cmdlets Appx), passé encodé (-EncodedCommand : ni
 * guillemets ni accents à protéger). Les valeurs passent par des variables d'environnement `ESSAI_*`, jamais par le
 * texte du script. Renvoie la sortie, lue comme du JSON si `json`. Erreur si PowerShell échoue.
 */
function powershell(script, { valeurs = {}, json = false } = {}) {
  // Lancé ainsi, PowerShell écrit ses erreurs en CLIXML sur la sortie d'erreur : le message passe par la sortie
  // standard, derrière une marque.
  const complet = `$ErrorActionPreference = 'Stop'; $ProgressPreference = 'SilentlyContinue'; [Console]::OutputEncoding = [Text.Encoding]::UTF8
try {
${script}
} catch { Write-Output "${MARQUE_D_ERREUR}$($_.Exception.Message)"; exit 1 }`
  const variables = Object.fromEntries(Object.entries(valeurs).map(([cle, valeur]) => [`ESSAI_${cle}`, String(valeur)]))
  const { status, stdout, error } = spawnSync("powershell.exe", ["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-EncodedCommand", encoder(complet)], {
    env: { ...process.env, ...variables },
    encoding: "utf-8",
    maxBuffer: 16 * 1024 * 1024
  })
  if (error) throw new Refus(`PowerShell introuvable : ${error.message}`)
  if (status !== 0) throw new Refus(`PowerShell a échoué : ${stdout.split(MARQUE_D_ERREUR)[1]?.trim() ?? `code de sortie ${status}`}`)
  const texte = stdout.trim()
  if (!json) return texte
  return texte === "" ? null : JSON.parse(texte)
}

const encoder = script => Buffer.from(script, "utf16le").toString("base64")

const enListe = valeur => (valeur === null ? [] : [valeur].flat())

/**
 * Lance une commande PowerShell minimale en administrateur : une seule fenêtre de contrôle de compte d'utilisateur.
 * La commande est passée encodée (-EncodedCommand), sans rien d'autre que ce qui est annoncé.
 */
function enAdministrateur(commande, annonce) {
  info(annonce)
  info("Windows va demander l'autorisation d'administrateur (une seule fenêtre) : c'est la seule étape qui en a besoin.")
  info(`Commande lancée en administrateur : ${commande}`)
  try {
    powershell(
      `$p = Start-Process powershell.exe -Verb RunAs -Wait -PassThru -WindowStyle Hidden -ArgumentList '-NoProfile','-NonInteractive','-EncodedCommand',$env:ESSAI_COMMANDE
if ($p.ExitCode -ne 0) { throw "code de sortie $($p.ExitCode)" }`,
      { valeurs: { COMMANDE: encoder(`$ErrorActionPreference = 'Stop'; ${commande}`) } }
    )
  } catch (erreur) {
    throw new Refus(`La commande administrateur n'a pas abouti (autorisation refusée ?) : ${erreur.message}`, { cause: erreur })
  }
}

/** Les paquets installés pour cet utilisateur sous ces noms (Get-AppxPackage), avec l'identifiant de leur application. */
function paquetsInstalles(noms) {
  const resultat = powershell(
    `$noms = $env:ESSAI_NOMS -split ';'
@(foreach ($nom in $noms) { Get-AppxPackage -Name $nom }) | ForEach-Object {
  $application = (Get-AppxPackageManifest -Package $_.PackageFullName).Package.Applications.Application | Select-Object -First 1
  [pscustomobject]@{ Name = $_.Name; PackageFullName = $_.PackageFullName; PackageFamilyName = $_.PackageFamilyName; Version = $_.Version.ToString();
    SignatureKind = $_.SignatureKind.ToString(); InstallLocation = $_.InstallLocation; ApplicationId = $application.Id }
} | ConvertTo-Json -Compress`,
    { valeurs: { NOMS: noms.join(";") }, json: true }
  )
  return enListe(resultat)
}

/** Chemins des exécutables lancés dont le nom est l'un de `noms` (sans .exe) ; une chaîne vide si le chemin est caché. */
function processEnCours(noms) {
  const resultat = powershell(`@(Get-Process -Name ($env:ESSAI_NOMS -split ';') -ErrorAction SilentlyContinue | ForEach-Object { [string]$_.Path }) | ConvertTo-Json -Compress`, {
    valeurs: { NOMS: noms.join(";") },
    json: true
  })
  return enListe(resultat)
}

const nomDeLExecutable = () => lireJson("electron-builder.json").productName

/** Refuse si l'application (version classique ou paquet) est ouverte. */
function exigerApplicationFermee(pourquoi) {
  if (processEnCours([nomDeLExecutable()]).length > 0) throw new Refus(`L'application « ${nomDeLExecutable()} » est ouverte : fermez-la avant ${pourquoi}, puis relancez la commande.`)
}

// --- 1. Paquet ---------------------------------------------------------------------------------------------------------

function construireLePaquet() {
  const essai = !complete
  etape(`Construction du paquet (npm run dist:store${essai ? " -- --essai" : ""})`)
  const { status } = spawnSync("npm", ["run", "dist:store", ...(essai ? ["--", "--essai"] : [])], { cwd: racine, stdio: "inherit", shell: true })
  if (status !== 0) throw new Refus("La construction du paquet a échoué (voir ci-dessus).")
  const modele = lireJson("electron-builder.json").appx.artifactName
  const nom = nomDuPaquetConstruit(essai ? modele.replace("-store-", "-store-essai-") : modele, paquetNpm.version)
  const chemin = path.join(racine, "dist", nom)
  if (!existsSync(chemin)) throw new Refus(`Paquet introuvable après la construction : ${chemin}`)
  return chemin
}

/** Identité déclarée par le manifeste du paquet (nom, éditeur, version), lue sans le décompresser. */
function lireLeManifeste(paquet) {
  const xml = powershell(
    `Add-Type -AssemblyName System.IO.Compression.FileSystem
$zip = [IO.Compression.ZipFile]::OpenRead($env:ESSAI_PAQUET)
try { $flux = $zip.GetEntry('AppxManifest.xml').Open(); (New-Object IO.StreamReader($flux)).ReadToEnd() } finally { $zip.Dispose() }`,
    { valeurs: { PAQUET: paquet } }
  )
  const manifeste = identiteDuManifeste(xml)
  if (!manifeste) throw new Refus(`Le paquet ${paquet} n'a pas de manifeste lisible (AppxManifest.xml).`)
  return manifeste
}

function choisirLePaquet(option) {
  if (!option) return construireLePaquet()
  const chemin = path.resolve(process.env.INIT_CWD ?? process.cwd(), option)
  if (!existsSync(chemin) || path.extname(chemin).toLowerCase() !== ".appx") throw new Refus(`--paquet : fichier .appx introuvable : ${chemin}`)
  return chemin
}

// --- 2. signtool ---------------------------------------------------------------------------------------------------

function signtoolDuSdk() {
  const bin = path.join(env.programFilesX86, "Windows Kits", "10", "bin")
  if (!existsSync(bin)) return null
  const candidats = readdirSync(bin).map(version => path.join(bin, version, "x64", "signtool.exe"))
  return choisirLeSigntool(candidats.filter(chemin => existsSync(chemin)))
}

/** Télécharge le paquet NuGet officiel (version fixée) dans le cache des outils, et le décompresse. */
async function signtoolDuPaquetNuget() {
  const dossier = path.join(outils, `${OUTILS_NUGET.nom}.${OUTILS_NUGET.version}`)
  const signtool = path.join(dossier, OUTILS_NUGET.signtool)
  if (existsSync(signtool)) return signtool
  const adresse = `https://www.nuget.org/api/v2/package/${OUTILS_NUGET.nom}/${OUTILS_NUGET.version}`
  info(`Pas de SDK Windows récent : téléchargement de ${OUTILS_NUGET.nom} ${OUTILS_NUGET.version} (environ 22 Mo) depuis nuget.org,`)
  info(`dans ${dossier}.`)
  const reponse = await fetch(adresse)
  if (!reponse.ok) throw new Refus(`Téléchargement impossible (${reponse.status}) : ${adresse}`)
  mkdirSync(outils, { recursive: true })
  const archive = `${dossier}.zip`
  writeFileSync(archive, Buffer.from(await reponse.arrayBuffer()))
  rmSync(dossier, { recursive: true, force: true })
  try {
    powershell("Expand-Archive -LiteralPath $env:ESSAI_ARCHIVE -DestinationPath $env:ESSAI_DOSSIER", { valeurs: { ARCHIVE: archive, DOSSIER: dossier } })
  } finally {
    rmSync(archive, { force: true })
  }
  if (!existsSync(signtool)) throw new Refus(`signtool.exe absent du paquet téléchargé (${signtool}).`)
  return signtool
}

function exigerLaSignatureDeMicrosoft(signtool) {
  const signature = powershell(
    `$s = Get-AuthenticodeSignature -LiteralPath $env:ESSAI_FICHIER
[pscustomobject]@{ statut = $s.Status.ToString(); signataire = $s.SignerCertificate.Subject } | ConvertTo-Json -Compress`,
    { valeurs: { FICHIER: signtool }, json: true }
  )
  if (!signatureDeMicrosoft(signature)) {
    throw new Refus(`signtool refusé : signature « ${signature.statut} » de « ${signature.signataire ?? "personne"} », au lieu d'une signature valide de Microsoft (${signtool}).`)
  }
}

async function trouverSigntool() {
  etape("signtool récent")
  const signtool = signtoolDuSdk() ?? (await signtoolDuPaquetNuget())
  exigerLaSignatureDeMicrosoft(signtool)
  info(`${signtool} (signé par Microsoft)`)
  return signtool
}

// --- 3 et 4. Certificat d'essai ------------------------------------------------------------------------------------

/** Le certificat d'essai de ce sujet dans Cert:\CurrentUser\My, créé s'il n'existe pas. Renvoie son empreinte. */
function certificatDEssai(sujet) {
  etape(`Certificat d'essai (${sujet})`)
  const { empreinte, cree } = powershell(
    `$c = Get-ChildItem Cert:\\CurrentUser\\My | Where-Object { $_.Subject -eq $env:ESSAI_SUJET -and $_.FriendlyName -eq $env:ESSAI_NOM -and $_.HasPrivateKey -and $_.NotAfter -gt (Get-Date).AddDays(1) } | Select-Object -First 1
$cree = $false
if (-not $c) {
  $c = New-SelfSignedCertificate -Type Custom -Subject $env:ESSAI_SUJET -KeyUsage DigitalSignature -FriendlyName $env:ESSAI_NOM -CertStoreLocation 'Cert:\\CurrentUser\\My' -TextExtension @('2.5.29.37={text}1.3.6.1.5.5.7.3.3', '2.5.29.19={text}')
  $cree = $true
}
[pscustomobject]@{ empreinte = $c.Thumbprint; cree = $cree } | ConvertTo-Json -Compress`,
    { valeurs: { SUJET: sujet, NOM: NOM_DU_CERTIFICAT }, json: true }
  )
  info(`${cree ? "Créé" : "Réutilisé"} dans Cert:\\CurrentUser\\My : « ${NOM_DU_CERTIFICAT} », empreinte ${empreinte}.`)
  return empreinte
}

const estApprouve = empreinte => powershell("Test-Path (Join-Path 'Cert:\\LocalMachine\\TrustedPeople' $env:ESSAI_EMPREINTE)", { valeurs: { EMPREINTE: empreinte } }) === "True"

/** Fait approuver le certificat par ce PC (partie publique dans Cert:\LocalMachine\TrustedPeople), si besoin. */
function approuverLeCertificat(empreinte) {
  etape("Approbation du certificat par ce PC")
  if (estApprouve(empreinte)) return info("Déjà dans Cert:\\LocalMachine\\TrustedPeople.")
  mkdirSync(dossierDeTravail, { recursive: true })
  const cer = path.join(dossierDeTravail, "certificat-d-essai.cer")
  powershell("Export-Certificate -Cert (Join-Path 'Cert:\\CurrentUser\\My' $env:ESSAI_EMPREINTE) -FilePath $env:ESSAI_CER -Type CERT | Out-Null", { valeurs: { EMPREINTE: empreinte, CER: cer } })
  enAdministrateur(
    `Import-Certificate -FilePath '${cer.replaceAll("'", "''")}' -CertStoreLocation Cert:\\LocalMachine\\TrustedPeople`,
    "Import de la partie publique du certificat (sans clé privée) dans Cert:\\LocalMachine\\TrustedPeople."
  )
  if (!estApprouve(empreinte)) throw new Refus("Le certificat n'a pas été approuvé (autorisation refusée ?).")
  info("Approuvé. Tant qu'il l'est, ce PC fait confiance à tout ce que ce certificat signe : npm run essai:store -- nettoyer le retire.")
}

// --- 5. Signature d'une copie ----------------------------------------------------------------------------------------

function signerUneCopie(paquet, signtool, empreinte) {
  etape("Signature d'une copie du paquet")
  mkdirSync(dossierDeTravail, { recursive: true })
  const copie = path.join(dossierDeTravail, `${path.basename(paquet, ".appx")}-essai-signe.appx`)
  copyFileSync(paquet, copie)
  const { status } = spawnSync(signtool, ["sign", "/fd", "SHA256", "/sha1", empreinte, "/s", "My", copie], { stdio: "inherit" })
  if (status !== 0) throw new Refus("signtool n'a pas pu signer la copie (voir ci-dessus).")
  info(`Copie signée : ${copie} (le paquet d'origine n'est pas modifié).`)
  return copie
}

// --- 6 et 7. Installation --------------------------------------------------------------------------------------------

/** Garde-fou : la version du Store n'est jamais touchée ; une copie d'essai de même version ou plus récente est remplacée. */
function decisionDuGardeFou(manifeste) {
  const decision = decisionAvantInstallation(paquetsInstalles([manifeste.nom]), manifeste.version)
  if (decision.action === "refuser") throw new Refus(decision.raison)
  return decision
}

function installer(copie, manifeste, decision) {
  etape("Installation de la copie signée")
  for (const ancien of decision.paquets ?? []) {
    info(`Une copie d'essai ${ancien.Version} est installée : elle est désinstallée pour être remplacée (${ancien.PackageFullName}).`)
    powershell("Remove-AppxPackage -Package $env:ESSAI_PAQUET", { valeurs: { PAQUET: ancien.PackageFullName } })
  }
  powershell("Add-AppxPackage -Path $env:ESSAI_COPIE", { valeurs: { COPIE: copie } })
  const installe = paquetsInstalles([manifeste.nom])[0] ?? null
  const ecarts = ecartsDeLInstallation(installe, manifeste.version)
  if (ecarts.length > 0) throw new Refus(`Le paquet n'est pas installé comme le Store l'installerait :\n- ${ecarts.join("\n- ")}`)
  info(`Installé : ${installe.PackageFullName}`)
  info(`Emplacement : ${installe.InstallLocation}`)
  info(`Signature : ${installe.SignatureKind}, version ${installe.Version}`)
  return installe
}

// --- 8. Serveur MCP ------------------------------------------------------------------------------------------------

/** Où le serveur copié par l'application est visible hors du paquet : dossier redirigé d'abord, vrai %APPDATA% ensuite. */
function copieDuServeurVisible(nomDeFamille) {
  const relatif = path.join(paquetNpm.name, "mcp", "serveur-mcp.mjs")
  const candidats = [path.join(env.localAppData, "Packages", nomDeFamille, "LocalCache", "Roaming", relatif), path.join(env.appData, relatif)]
  return candidats.find(chemin => existsSync(chemin)) ?? null
}

const dateDeModification = chemin => (chemin ? statSync(chemin).mtimeMs : null)
const pause = millisecondes => new Promise(resoudre => setTimeout(resoudre, millisecondes))

/**
 * Lance l'application par le menu des applications (`shell:AppsFolder\<AUMID>`, une activation du paquet comme depuis
 * le menu Démarrer), puis attend que sa copie du serveur MCP apparaisse ou change : c'est l'application qui la fait, à
 * son démarrage (src/backend/copie-du-serveur-mcp.ts), comme chez un utilisateur. Renvoie le chemin de la copie.
 */
async function lancerLApplicationPourLaCopie(installe, raison) {
  const aumid = `${installe.PackageFamilyName}!${installe.ApplicationId}`
  const avant = dateDeModification(copieDuServeurVisible(installe.PackageFamilyName))
  info(raison)
  info(`Lancement de l'application (shell:AppsFolder\\${aumid}) ; elle reste ouverte pour la suite de l'essai.`)
  spawn("explorer.exe", [`shell:AppsFolder\\${aumid}`], { detached: true, stdio: "ignore" }).unref()
  for (let attente = 0; attente < SECONDES_POUR_LA_COPIE_DU_SERVEUR * 2; attente++) {
    await pause(500)
    const copie = copieDuServeurVisible(installe.PackageFamilyName)
    if (copie && dateDeModification(copie) !== avant) return copie
  }
  throw new Refus(
    `Pas de copie à jour du serveur après ${SECONDES_POUR_LA_COPIE_DU_SERVEUR} s. Lancez l'application depuis le menu Démarrer (« ${nomDeLExecutable()} »), attendez sa fenêtre, puis : npm run essai:store -- verifier`
  )
}

/** Lance le serveur par l'alias d'exécution, avec la configuration de la version du Store, et attend « prêt ». */
function lancerLeServeur(entree) {
  return new Promise((resoudre, rejeter) => {
    const serveur = spawn(entree.command, entree.args, { env: { ...process.env, ...entree.env }, stdio: ["pipe", "ignore", "pipe"], windowsHide: true })
    let sortie = ""
    let fini = false
    const finir = (erreur, resultat) => {
      if (fini) return
      fini = true
      clearTimeout(minuterie)
      serveur.kill()
      if (erreur) rejeter(erreur)
      else resoudre(resultat)
    }
    const minuterie = setTimeout(() => finir(new Refus(`Le serveur n'a pas dit « prêt » en ${SECONDES_POUR_LE_SERVEUR} s. Sortie :\n${sortie.trim()}`)), SECONDES_POUR_LE_SERVEUR * 1000)
    // L'entrée standard reste ouverte, comme avec un client d'IA ; le serveur arrêté, elle peut se fermer en erreur.
    serveur.stdin.on("error", () => {})
    serveur.on("error", erreur => finir(new Refus(`Impossible de lancer ${entree.command} : ${erreur.message}`)))
    serveur.on("exit", code => finir(new Refus(`Le serveur s'est arrêté (code ${code}) avant d'être prêt. Sortie :\n${sortie.trim()}`)))
    serveur.stderr.on("data", morceau => {
      sortie += morceau
      const ligne = sortie.split("\n").find(texte => versionDuServeurPret(texte))
      if (ligne) finir(null, { version: versionDuServeurPret(ligne), ligne: ligne.trim() })
    })
  })
}

function exigerLAlias(entree) {
  try {
    lstatSync(entree.command)
  } catch {
    throw new Refus(`Alias d'exécution absent : ${entree.command}. Vérifiez qu'il est activé (Paramètres > Applications > Paramètres avancés des applications > Alias d'exécution d'application).`)
  }
}

/**
 * Lance le serveur comme le ferait un client d'IA configuré pour la version du Store, et vérifie sa version. La copie
 * du serveur n'existe qu'après un lancement de l'application, et n'est mise à jour qu'au lancement suivant une mise à
 * jour : si elle manque ou annonce une autre version, l'application est lancée une fois, puis le serveur relancé.
 */
async function verifierLeServeurMcp(installe) {
  etape("Serveur MCP par l'alias d'exécution")
  const entree = entreeDuStore()
  exigerLAlias(entree)
  const attendue = installe.Version.split(".").slice(0, 3).join(".")
  let copie = copieDuServeurVisible(installe.PackageFamilyName)
  if (!copie) copie = await lancerLApplicationPourLaCopie(installe, "La copie du serveur dans le dossier de données n'existe pas encore : l'application la fait à son lancement.")
  info(`Copie du serveur : ${copie}`)
  info(`Commande : ELECTRON_RUN_AS_NODE=1 "${entree.command}" ${entree.args.map(argument => `"${argument}"`).join(" ")}`)
  let { version, ligne } = await lancerLeServeur(entree)
  if (version !== attendue) {
    await lancerLApplicationPourLaCopie(installe, `Le serveur copié est celui de la version ${version} : l'application le met à jour à son lancement.`)
    ;({ version, ligne } = await lancerLeServeur(entree))
  }
  info(ligne)
  if (version !== attendue) throw new Refus(`Le serveur annonce la version ${version}, le paquet installé est la ${attendue}.`)
  info("Serveur prêt, puis arrêté.")
}

/** Le paquet d'essai installé, pour `verifier`. */
function paquetDEssaiInstalle() {
  const installes = paquetsInstalles(nomsDesPaquets())
  const installe = installes.find(paquet => paquet.SignatureKind === "Developer") ?? installes[0]
  if (!installe) throw new Refus("Aucune copie d'essai installée : npm run essai:store")
  if (installe.SignatureKind !== "Developer") info(`Attention : le paquet installé est signé « ${installe.SignatureKind} », ce n'est pas une copie d'essai.`)
  return installe
}

// --- Options : nouvel utilisateur et Claude Desktop ----------------------------------------------------------------------

function mettreDeCoteLesDonnees() {
  etape("Nouvel utilisateur : données de la version classique mises de côté")
  if (!existsSync(donneesClassiques)) return info(`Pas de dossier ${donneesClassiques} : rien à mettre de côté.`)
  if (existsSync(donneesMisesDeCote)) throw new Refus(`${donneesMisesDeCote} existe déjà (essai précédent ?) : rien n'est déplacé. Lancez npm run essai:store -- nettoyer, ou déplacez l'un des deux dossiers à la main.`)
  exigerApplicationFermee("de déplacer ses données")
  renameSync(donneesClassiques, donneesMisesDeCote)
  info(`${donneesClassiques} renommé en ${donneesMisesDeCote} (remis en place par npm run essai:store -- nettoyer).`)
}

/** Refuse si Claude Desktop est ouvert (le process « claude » de Claude Code, lui, n'est pas en cause). */
function exigerClaudeDesktopFerme() {
  if (claudeDesktopEstOuvert(processEnCours(["claude"]))) {
    throw new Refus("Claude Desktop est ouvert : quittez-le complètement (clic droit sur son icône près de l'horloge > Quitter), sinon il peut réécrire son fichier de configuration en se fermant. Puis relancez la commande.")
  }
}

function trouverLeFichierDeClaudeDesktop() {
  const packages = path.join(env.localAppData, "Packages")
  const paquetsClaude = existsSync(packages) ? readdirSync(packages).filter(nom => nom.startsWith("Claude_")) : []
  return fichierDeClaudeDesktop({ appData: env.appData, localAppData: env.localAppData, paquetsClaude, existe: existsSync })
}

/** Modifie le fichier de Claude Desktop (fermé), après une copie de sauvegarde horodatée. */
function modifierLaConfigurationDeClaudeDesktop(modifier) {
  const fichier = trouverLeFichierDeClaudeDesktop()
  if (!fichier) throw new Refus("Claude Desktop introuvable (ni en paquet, ni dans %APPDATA%\\Claude) : installez-le et lancez-le une fois.")
  info(`Fichier (${fichier.mode === "paquet" ? "Claude Desktop en paquet MSIX" : "installation classique"}) : ${fichier.chemin}`)
  const texte = fichier.existe ? readFileSync(fichier.chemin, "utf-8") : ""
  const { resultat, texte: nouveau } = modifier(texte)
  if (nouveau === undefined) return resultat
  exigerClaudeDesktopFerme()
  if (fichier.existe) {
    const sauvegarde = cheminDeSauvegarde(fichier.chemin, new Date())
    copyFileSync(fichier.chemin, sauvegarde)
    info(`Sauvegarde : ${sauvegarde}`)
  } else mkdirSync(path.dirname(fichier.chemin), { recursive: true })
  writeFileSync(fichier.chemin, nouveau)
  return resultat
}

function ajouterAClaudeDesktop() {
  etape("Claude Desktop : entrée du serveur MCP")
  const resultat = modifierLaConfigurationDeClaudeDesktop(texte => ajouterLEntree(texte, entreeDuStore()))
  const messages = {
    ajoutee: "Entrée « simulateur-independant-fr » ajoutée. Relancez Claude Desktop ; les outils sont dans l'onglet Chat.",
    identique: "L'entrée est déjà là, identique : rien n'est modifié.",
    differente: "Une entrée « simulateur-independant-fr » existe déjà avec une autre commande (version classique ?) : rien n'est modifié. Remplacez-la à la main par celle de la fenêtre « Utiliser avec une IA (MCP) » de la version du Store."
  }
  info(messages[resultat])
}

function retirerDeClaudeDesktop() {
  etape("Claude Desktop : retrait de l'entrée du serveur MCP")
  const resultat = modifierLaConfigurationDeClaudeDesktop(texte => retirerLEntree(texte, entreeDuStore()))
  const messages = {
    retiree: "Entrée de la version du Store retirée ; le reste du fichier est inchangé.",
    absente: "Pas d'entrée « simulateur-independant-fr » : rien n'est modifié.",
    differente: "L'entrée « simulateur-independant-fr » n'est pas celle de la version du Store (version classique ?) : elle est laissée."
  }
  info(messages[resultat])
}

// --- Commandes -----------------------------------------------------------------------------------------------------------

async function commandeInstaller(options) {
  const paquet = choisirLePaquet(options.paquet)
  const manifeste = lireLeManifeste(paquet)
  info(`Paquet : ${paquet}`)
  info(`Identité : ${manifeste.nom} ${manifeste.version}, éditeur ${manifeste.editeur}`)
  if (!options.paquet && manifeste.version !== versionDuPaquet(paquetNpm.version)) {
    throw new Refus(`Le paquet construit est la version ${manifeste.version}, package.json annonce la ${paquetNpm.version}.`)
  }
  const decision = decisionDuGardeFou(manifeste)
  if (options.claudeDesktop) exigerClaudeDesktopFerme()
  if (options.nouvelUtilisateur) mettreDeCoteLesDonnees()
  if (decision.action === "remplacer") exigerApplicationFermee("de remplacer la copie d'essai")
  const signtool = await trouverSigntool()
  const empreinte = certificatDEssai(manifeste.editeur)
  approuverLeCertificat(empreinte)
  const copie = signerUneCopie(paquet, signtool, empreinte)
  const installe = installer(copie, manifeste, decision)
  if (options.claudeDesktop) ajouterAClaudeDesktop()
  await verifierLeServeurMcp(installe)
  etape("Résumé")
  info(`${installe.PackageFullName} installé sous WindowsApps, signé avec le certificat d'essai, serveur MCP vérifié.`)
  info("Suite : essayer l'application et Claude Desktop (publier-sur-le-store.md, étape 2), puis npm run essai:store -- nettoyer.")
}

/** Les certificats d'essai : ceux du script dans Cert:\CurrentUser\My, et leurs copies dans Cert:\LocalMachine\TrustedPeople. */
function certificatsDEssai() {
  const resultat = powershell(
    `$sujets = $env:ESSAI_SUJETS -split ';'
$miens = @(Get-ChildItem Cert:\\CurrentUser\\My | Where-Object FriendlyName -eq $env:ESSAI_NOM)
$empreintes = $miens | ForEach-Object Thumbprint
$approuves = @(Get-ChildItem Cert:\\LocalMachine\\TrustedPeople | Where-Object { ($empreintes -contains $_.Thumbprint) -or (($sujets -contains $_.Subject) -and $_.Subject -eq $_.Issuer) })
[pscustomobject]@{ utilisateur = @($miens | ForEach-Object { $_.Thumbprint }); approuves = @($approuves | ForEach-Object { $_.Thumbprint }) } | ConvertTo-Json -Compress`,
    { valeurs: { NOM: NOM_DU_CERTIFICAT, SUJETS: [identite.publisher, IDENTITE_D_ESSAI.publisher].join(";") }, json: true }
  )
  return { utilisateur: enListe(resultat.utilisateur), approuves: enListe(resultat.approuves) }
}

function etatDeClaudeDesktop() {
  const fichier = trouverLeFichierDeClaudeDesktop()
  if (!fichier) return "Claude Desktop introuvable."
  if (!fichier.existe) return `pas encore de fichier (${fichier.chemin}).`
  const etats = { absente: "entrée absente", identique: "entrée de la version du Store présente", differente: "entrée « simulateur-independant-fr » présente, différente de celle du Store", illisible: "fichier illisible (JSON invalide)" }
  return `${etats[etatDeLEntree(readFileSync(fichier.chemin, "utf-8"), entreeDuStore())]} (${fichier.chemin}).`
}

function commandeEtat() {
  etape("Paquets installés")
  const installes = paquetsInstalles(nomsDesPaquets())
  if (installes.length === 0) info("Aucun.")
  for (const paquet of installes) info(`${paquet.PackageFullName} : version ${paquet.Version}, signature ${paquet.SignatureKind}, ${paquet.InstallLocation}`)
  etape("Certificat d'essai")
  const { utilisateur, approuves } = certificatsDEssai()
  info(utilisateur.length > 0 ? `Dans Cert:\\CurrentUser\\My : ${utilisateur.join(", ")}` : "Absent de Cert:\\CurrentUser\\My.")
  info(approuves.length > 0 ? `Approuvé par ce PC (Cert:\\LocalMachine\\TrustedPeople) : ${approuves.join(", ")}` : "Non approuvé par ce PC.")
  etape("Données")
  info(`${donneesClassiques} : ${existsSync(donneesClassiques) ? "présent" : "absent"}`)
  info(`${donneesMisesDeCote} : ${existsSync(donneesMisesDeCote) ? "présent (mis de côté par --nouvel-utilisateur)" : "absent"}`)
  const nomDeFamille = installes[0]?.PackageFamilyName ?? nomDeFamilleDuPaquet(identite)
  info(`Copie du serveur MCP : ${copieDuServeurVisible(nomDeFamille) ?? "absente"}`)
  info(`Copies signées et fichiers temporaires : ${existsSync(dossierDeTravail) ? dossierDeTravail : "aucun"}`)
  etape("Claude Desktop")
  info(etatDeClaudeDesktop())
}

function desinstallerLesCopiesDEssai() {
  etape("Désinstallation de la copie d'essai")
  const installes = paquetsInstalles(nomsDesPaquets())
  for (const store of installes.filter(paquet => paquet.SignatureKind === "Store")) info(`${store.PackageFullName} vient du Microsoft Store : il n'est pas touché.`)
  const essais = installes.filter(paquet => ["Developer", "None"].includes(paquet.SignatureKind))
  if (essais.length === 0) return info("Aucune copie d'essai installée.")
  exigerApplicationFermee("de la désinstaller")
  for (const paquet of essais) {
    info(`Désinstallation de ${paquet.PackageFullName} (Windows supprime aussi ses données redirigées, LocalCache).`)
    powershell("Remove-AppxPackage -Package $env:ESSAI_PAQUET", { valeurs: { PAQUET: paquet.PackageFullName } })
  }
}

function retirerLesCertificats() {
  etape("Retrait du certificat d'essai")
  const { utilisateur, approuves } = certificatsDEssai()
  if (approuves.length > 0) {
    const chemins = approuves.map(empreinte => `'Cert:\\LocalMachine\\TrustedPeople\\${empreinte}'`).join(",")
    enAdministrateur(`Remove-Item ${chemins}`, `Retrait de Cert:\\LocalMachine\\TrustedPeople : ${approuves.join(", ")}.`)
  } else info("Non approuvé par ce PC : rien à retirer de Cert:\\LocalMachine\\TrustedPeople.")
  for (const empreinte of utilisateur) {
    powershell("Remove-Item (Join-Path 'Cert:\\CurrentUser\\My' $env:ESSAI_EMPREINTE)", { valeurs: { EMPREINTE: empreinte } })
    info(`Retiré de Cert:\\CurrentUser\\My : ${empreinte}`)
  }
}

function remettreLesDonneesEnPlace() {
  etape("Données de la version classique")
  if (!existsSync(donneesMisesDeCote)) return info("Rien n'a été mis de côté.")
  if (existsSync(donneesClassiques)) {
    throw new Refus(
      `${donneesClassiques} existe à côté de ${donneesMisesDeCote} : rien n'est déplacé. Si le premier ne contient rien à garder, supprimez-le, puis relancez npm run essai:store -- nettoyer ; sinon, comparez les deux dossiers et gardez le bon sous le nom ${paquetNpm.name}.`
    )
  }
  renameSync(donneesMisesDeCote, donneesClassiques)
  info(`${donneesMisesDeCote} remis en place sous ${donneesClassiques}.`)
}

function commandeNettoyer(options) {
  desinstallerLesCopiesDEssai()
  retirerLesCertificats()
  etape("Copies signées et fichiers temporaires")
  rmSync(dossierDeTravail, { recursive: true, force: true })
  info(`${dossierDeTravail} supprimé. Le signtool téléchargé, s'il y en a un, reste dans ${outils}.`)
  remettreLesDonneesEnPlace()
  if (options.claudeDesktop) return retirerDeClaudeDesktop()
  etape("Claude Desktop")
  info(etatDeClaudeDesktop())
  info("L'entrée du serveur est laissée : elle reste valable pour la version du Microsoft Store. Pour la retirer : npm run essai:store -- nettoyer --claude-desktop")
}

async function principal() {
  if (process.platform !== "win32") throw new Refus("npm run essai:store ne fonctionne que sous Windows (paquets MSIX, certificats, alias d'exécution).")
  const options = lireLesArguments(process.argv.slice(2))
  if (options.erreur) throw new Refus(`${options.erreur}\nUsage : npm run essai:store -- [installer|verifier|etat|nettoyer] [--paquet <fichier.appx>] [--nouvel-utilisateur] [--claude-desktop]`)
  const erreurs = complete ? erreursDeLIdentite(identite) : []
  if (erreurs.length > 0) throw new Refus(`Identité du paquet invalide (build/store/identite.json) :\n- ${erreurs.join("\n- ")}`)
  const commandes = {
    installer: () => commandeInstaller(options),
    verifier: () => verifierLeServeurMcp(paquetDEssaiInstalle()),
    etat: commandeEtat,
    nettoyer: () => commandeNettoyer(options)
  }
  await commandes[options.commande]()
}

try {
  await principal()
} catch (erreur) {
  console.error(`\nÉchec : ${erreur instanceof Refus ? erreur.message : (erreur.stack ?? erreur)}`)
  process.exitCode = 1
}
