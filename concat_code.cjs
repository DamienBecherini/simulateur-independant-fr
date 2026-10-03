const fs = require("fs")
const path = require("path")
// const { globby } = require("globby")

const CONFIG_FILE = ".concatrc.json"
const BUILD_DIR = "build"
const OUTPUT_FILE_STABLE = path.join(BUILD_DIR, "project_context.md")

/**
 * Génère une arborescence de projet textuelle à partir d'une liste de fichiers.
 * C'est une fonction 100% JavaScript qui ne dépend pas de la commande 'tree'.
 * @param {string[]} files - Liste de tous les chemins de fichiers à inclure.
 * @returns {string} - L'arborescence formatée.
 */
function generateProjectTreeFromPaths(files) {
  const rootName = path.basename(process.cwd())
  const tree = { name: rootName, children: {} }

  files.forEach(file => {
    const parts = file.replace(/\\/g, "/").split("/")
    let currentLevel = tree.children
    parts.forEach((part, index) => {
      if (!currentLevel[part]) {
        currentLevel[part] = {}
      }
      if (index < parts.length - 1) {
        currentLevel[part].children = currentLevel[part].children || {}
        currentLevel = currentLevel[part].children
      }
    })
  })

  const createTreeString = (node, prefix = "") => {
    let result = ""
    const entries = Object.keys(node)
    entries.forEach((entry, index) => {
      const isLast = index === entries.length - 1
      result += `${prefix}${isLast ? "└── " : "├── "}${entry}\n`
      if (node[entry].children) {
        result += createTreeString(node[entry].children, `${prefix}${isLast ? "    " : "│   "}`)
      }
    })
    return result
  }

  return `${tree.name}\n${createTreeString(tree.children)}`
}

async function concatenateFiles() {
  const { globby } = await import("globby")
  console.log("Démarrage du script de contextualisation avancé...")

  if (!fs.existsSync(BUILD_DIR)) {
    fs.mkdirSync(BUILD_DIR, { recursive: true })
    console.log(`Dossier de sortie '${BUILD_DIR}' créé.`)
  }

  if (!fs.existsSync(CONFIG_FILE)) {
    console.error(`Erreur : Fichier de configuration '${CONFIG_FILE}' introuvable.`)
    process.exit(1)
  }
  const config = JSON.parse(fs.readFileSync(CONFIG_FILE, "utf-8"))
  const { include: includePatterns = [], exclude: excludePatterns = [] } = config

  console.log("Génération de l'arborescence du projet...")
  const allVisiblePaths = await globby(["**/*"], {
    gitignore: true,
    dot: true,
    ignore: [...excludePatterns, ".git/**"] // On s'assure d'exclure .git
  })
  const projectTree = generateProjectTreeFromPaths(allVisiblePaths)

  const filesToInclude = await globby(includePatterns, {
    gitignore: true,
    dot: true,
    ignore: excludePatterns
  })

  if (filesToInclude.length === 0) {
    console.warn("Aucun fichier trouvé pour l'inclusion de contenu.")
  } else {
    console.log(`Trouvé ${filesToInclude.length} fichiers à inclure.`)
  }

  let totalChars = 0
  const allContent = filesToInclude.map(file => {
    const content = fs.readFileSync(file, "utf-8")
    totalChars += content.length
    const portableFilePath = file.replace(/\\/g, "/")
    const extension = path.extname(portableFilePath).substring(1)
    return `### FILE: ${portableFilePath}\n\n\`\`\`${extension}\n${content}\n\`\`\``
  })
  const estimatedTokens = Math.round(totalChars / 4)

  const useTimestamp = !process.argv.includes("--no-timestamp")
  const finalFileName = useTimestamp ? path.join(BUILD_DIR, `${new Date().toISOString().replace(/[:.]/g, "-")}.md`) : OUTPUT_FILE_STABLE

  const finalHeader = `
# CONTEXTE DU PROJET : ${path.basename(process.cwd())}
- Date de génération : ${new Date().toLocaleString("fr-FR")}
## STATISTIQUES
- Nombre de fichiers inclus : ${filesToInclude.length}
- Nombre total de caractères : ${totalChars.toLocaleString("fr-FR")}
- **Estimation de Tokens (approx. 4 char/token) : ~${estimatedTokens.toLocaleString("fr-FR")} tokens**
## ARBORESCENCE DU PROJET (contenu du fichier)

\`\`\`
${projectTree}
\`\`\`
`
  const finalContent = finalHeader + "\n---\n\n" + allContent.join("\n\n---\n\n")

  fs.writeFileSync(finalFileName, finalContent)

  // --- NOUVEAU : Bloc de résumé pour la console ---
  const summary = `
----------------------------------------------------
  RÉSUMÉ DE LA GÉNÉRATION
----------------------------------------------------
Arborescence :
\`\`\`
${projectTree}
\`\`\`
Statistiques :
- Fichiers inclus : ${filesToInclude.length}
- Caractères totaux : ${totalChars.toLocaleString("fr-FR")}
- Tokens estimés : ~${estimatedTokens.toLocaleString("fr-FR")}
----------------------------------------------------
`
  console.log(summary)
  // --- FIN DU NOUVEAU BLOC ---

  console.log(`\n✅ Succès ! Le contexte complet a été écrit dans : ${path.resolve(finalFileName)}`)
}

concatenateFiles().catch(error => {
  console.error("❌ Une erreur inattendue est survenue :", error)
})
