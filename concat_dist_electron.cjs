// concat_dist_electron.cjs

const fs = require("fs").promises
const path = require("path")

// Dynamically import globby which is an ES module
async function run() {
  const { globby } = await import("globby")

  const TARGET_DIR = "dist-electron"
  const OUTPUT_FILE = "_DIST_ELECTRON_CONTENT.md"

  console.log(`Analyse du dossier "${TARGET_DIR}"...`)

  try {
    // Vérifier si le dossier cible existe
    await fs.access(TARGET_DIR)
  } catch (error) {
    console.error(`\nERREUR : Le dossier "${TARGET_DIR}" n'a pas été trouvé.`)
    console.error("Veuillez vous assurer d'avoir lancé la compilation (`npm run transpile:electron` ou `npm run dev`) avant d'exécuter ce script.")
    process.exit(1)
  }

  const filePaths = await globby([`${TARGET_DIR}/**/*`], {
    gitignore: false,
    ignore: ["node_modules/**", "**/dist/**", "**/build/**"],
    absolute: false
  })

  if (filePaths.length === 0) {
    console.warn(`Aucun fichier trouvé dans le dossier "${TARGET_DIR}". Le fichier de sortie sera vide.`)
  }

  const contentBlocks = []
  const generationDate = new Date().toLocaleString("fr-FR")

  // En-tête du fichier de sortie
  const header = `# CONTENU DU DOSSIER : ${TARGET_DIR}\n` + `- Date de génération : ${generationDate}\n` + `## STATISTIQUES\n` + `- Nombre de fichiers inclus : ${filePaths.length}\n\n---\n\n`

  contentBlocks.push(header)

  for (const filePath of filePaths) {
    const relativePath = path.relative(process.cwd(), filePath).replace(/\\/g, "/")
    const content = await fs.readFile(filePath, "utf-8")

    const fileHeader = `### FILE: ${relativePath}\n\n`
    const codeBlock = `\`\`\`javascript\n${content}\n\`\`\`\n\n---\n\n`

    contentBlocks.push(fileHeader, codeBlock)
  }

  await fs.writeFile(OUTPUT_FILE, contentBlocks.join(""))

  console.log(`\nOpération terminée avec succès !`)
  console.log(`Le contenu du dossier "${TARGET_DIR}" a été exporté dans le fichier : ${OUTPUT_FILE}`)
}

run().catch(console.error)
