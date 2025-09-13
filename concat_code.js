// concat_code.js - VERSION FINALE AVEC SORTIE CONSOLE AMÉLIORÉE
const fs = require("fs")
const path = require("path")
const { globby } = require("globby")
const tree = require("tree-node-cli")

// --- CONFIGURATION CENTRALE DES EXCLUSIONS ---
const ignoreGlobs = ["**/node_modules/**", "**/package-lock.json", "**/build/**", "**/dist/**", "**/out/**", "**/release/**", "**/create_sass_structure.sh", "**/concat_code.js"]
const ignoreRegex = [/node_modules/, /build/, /dist/, /out/, /release/, /project_context.*\.md/]

// --- GESTION DES ARGUMENTS ET DU NOM DE FICHIER ---
const noTimestamp = process.argv.includes("--no-timestamp")
const outputDir = "build"
let outputFilename = "project_context.md"
if (!noTimestamp) {
  const now = new Date()
  const timestamp = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}_${String(now.getHours()).padStart(2, "0")}-${String(now.getMinutes()).padStart(2, "0")}-${String(now.getSeconds()).padStart(2, "0")}`
  outputFilename = `project_context_${timestamp}.md`
}
const outputFile = path.join(outputDir, outputFilename)

async function concatenateProjectFiles() {
  try {
    console.log("🔍 Analyse du projet et collecte des fichiers...")

    // --- 1. COLLECTE ET PRÉPARATION DES DONNÉES ---
    const files = await globby(["**/*"], { gitignore: true, ignore: ignoreGlobs, dot: true })

    let totalCharacters = 0
    const fileContents = files.map(file => {
      const content = fs.readFileSync(file, "utf-8")
      totalCharacters += content.length
      return { path: file, content }
    })

    const estimatedTokens = Math.round(totalCharacters / 4)
    const fileTree = tree(".", { exclude: ignoreRegex, allFiles: true })

    // --- 2. PRÉPARATION DES BLOCS DE TEXTE ---
    const statsBlock = `## STATISTIQUES
- Nombre de fichiers inclus : ${files.length}
- Nombre total de caractères : ${totalCharacters.toLocaleString("fr-FR")}
- **Estimation de Tokens (approx. 4 char/token) : ~${estimatedTokens.toLocaleString("fr-FR")} tokens** 
  (Compatible avec les contextes de modèles comme GPT-4, Claude 3, Gemini Pro)`

    const fileHeader = `# CONTEXTE DU PROJET : simulateur-independant-fr
- Date de génération : ${new Date().toLocaleString("fr-FR")}

${statsBlock}

## ARBORESCENCE DU PROJET (contenu du fichier)
`

    // --- 3. AFFICHAGE DANS LA CONSOLE (DANS L'ORDRE DEMANDÉ) ---
    console.log("----------------------------------------------------")
    console.log("ARBORESCENCE DU PROJET")
    console.log("----------------------------------------------------")
    console.log(fileTree)
    console.log("----------------------------------------------------")
    console.log(statsBlock)
    console.log("----------------------------------------------------")

    // --- 4. ÉCRITURE DU FICHIER DE SORTIE ---
    if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true })

    fs.writeFileSync(outputFile, fileHeader.trim() + "\n\n")
    fs.appendFileSync(outputFile, "```\n" + fileTree + "\n```\n\n---\n\n")

    for (const { path: filePath, content } of fileContents) {
      const language = path.extname(filePath).slice(1) || "text"
      const fileHeader = `### FILE: ${filePath}\n\n`
      const codeBlock = "```" + language + "\n" + content + "\n" + "```" + "\n\n"
      fs.appendFileSync(outputFile, fileHeader + codeBlock)
    }

    console.log(`✅ Projet concaténé avec succès dans le fichier : ${outputFile}`)
  } catch (error) {
    console.error("❌ Une erreur est survenue lors de la concaténation :", error)
  }
}

concatenateProjectFiles()
