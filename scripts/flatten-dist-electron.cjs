// scripts/flatten-dist-electron.cjs
const fs = require("fs-extra")
const path = require("path")

const sourceDir = path.join(__dirname, "../dist-electron/electron")
const destDir = path.join(__dirname, "../dist-electron")

async function flatten() {
  try {
    // On vérifie si le dossier source existe
    if (!(await fs.pathExists(sourceDir))) {
      console.log('Le sous-dossier "electron" n\'existe pas dans dist-electron, rien à faire.')
      return
    }

    console.log(`Déplacement du contenu de ${sourceDir} vers ${destDir}...`)

    // On lit la liste des fichiers/dossiers dans le répertoire source
    const filesToMove = await fs.readdir(sourceDir)

    // On crée une promesse pour chaque opération de déplacement
    const movePromises = filesToMove.map(file => {
      const sourcePath = path.join(sourceDir, file)
      const destPath = path.join(destDir, file)
      // On déplace chaque élément individuellement vers la destination
      return fs.move(sourcePath, destPath, { overwrite: true })
    })

    // On attend que toutes les opérations soient terminées
    await Promise.all(movePromises)

    // Une fois que tout est déplacé, le dossier source est vide et on peut le supprimer
    await fs.remove(sourceDir)

    console.log("Aplatissement du dossier dist-electron terminé avec succès.")
  } catch (error) {
    console.error("Erreur lors de l'aplatissement du dossier dist-electron:", error)
    process.exit(1)
  }
}

flatten()
