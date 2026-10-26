import { existsSync, readdirSync, readFileSync, renameSync, statSync, writeFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

const dist = join(dirname(fileURLToPath(import.meta.url)), "..", "dist")
const from = join(dist, "assets", "node_modules")
const to = join(dist, "assets", "vendor")
const TEXT_EXTENSIONS = [".js", ".html", ".json", ".css", ".map"]

function walk(dir) {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name)
    return statSync(path).isDirectory() ? walk(path) : [path]
  })
}

if (!existsSync(from)) {
  console.log("fix-dist-assets: no hay assets/node_modules, nada que hacer")
  process.exit(0)
}

renameSync(from, to)

let rewritten = 0
for (const file of walk(dist)) {
  if (!TEXT_EXTENSIONS.some((ext) => file.endsWith(ext))) continue
  const content = readFileSync(file, "utf8")
  const fixed = content.replaceAll("/assets/node_modules/", "/assets/vendor/")
  if (fixed !== content) {
    writeFileSync(file, fixed)
    rewritten++
  }
}

console.log(`fix-dist-assets: assets/node_modules -> assets/vendor (${rewritten} archivos actualizados)`)
