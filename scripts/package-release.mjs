import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const projectRoot = path.resolve(__dirname, '..')

/**
 * Packages the portable .7z archive and exports build artifacts (installer, portable archive,
 * and unpacked x64 binary/portable folder) to the output directory (`../Nullex-Rust` by default).
 */
export function exportReleaseArtifacts({ target, archLabel }) {
  const pkg = JSON.parse(fs.readFileSync(path.join(projectRoot, 'package.json'), 'utf8'))
  const version = pkg.version
  const outputDir = process.env.NULLEX_OUTPUT_DIR
    ? path.resolve(process.env.NULLEX_OUTPUT_DIR)
    : path.resolve(projectRoot, '..', 'Nullex-Rust')

  fs.mkdirSync(outputDir, { recursive: true })

  const releaseDir = path.join(projectRoot, 'src-tauri', 'target', target, 'release')
  const setupName = `Nullex_${version}_${archLabel}-setup.exe`
  const setupSrc = path.join(releaseDir, 'bundle', 'nsis', setupName)
  const portableName = `Nullex_${archLabel}-portable.7z`
  const sevenZip = path.join(projectRoot, 'src-tauri', 'resources', 'files', '7za.exe')

  if (!fs.existsSync(setupSrc)) {
    throw new Error(`NSIS installer not found: ${setupSrc}`)
  }

  fs.copyFileSync(setupSrc, path.join(outputDir, setupName))
  console.log(`Copied installer -> ${path.join(outputDir, setupName)}`)

  const stageDir = path.join(releaseDir, '_portable_stage')
  fs.rmSync(stageDir, { recursive: true, force: true })
  fs.mkdirSync(stageDir, { recursive: true })

  try {
    fs.copyFileSync(path.join(releaseDir, 'Nullex.exe'), path.join(stageDir, 'Nullex.exe'))
    fs.cpSync(path.join(releaseDir, 'resources'), path.join(stageDir, 'resources'), { recursive: true })
    fs.writeFileSync(path.join(stageDir, 'PORTABLE'), '')

    const portableOut = path.join(outputDir, portableName)
    fs.rmSync(portableOut, { force: true })
    execFileSync(sevenZip, ['a', '-t7z', '-mx=5', portableOut, '.'], {
      cwd: stageDir,
      stdio: 'inherit',
    })
    console.log(`Packaged portable -> ${portableOut}`)

    if (archLabel === 'x64') {
      fs.copyFileSync(path.join(releaseDir, 'Nullex.exe'), path.join(outputDir, 'Nullex.exe'))
      const unpackedDir = path.join(outputDir, 'Nullex-Portable')
      fs.mkdirSync(unpackedDir, { recursive: true })
      fs.copyFileSync(path.join(stageDir, 'Nullex.exe'), path.join(unpackedDir, 'Nullex.exe'))
      fs.writeFileSync(path.join(unpackedDir, 'PORTABLE'), '')
      const destResources = path.join(unpackedDir, 'resources')
      fs.rmSync(destResources, { recursive: true, force: true })
      fs.cpSync(path.join(stageDir, 'resources'), destResources, { recursive: true })
      console.log(`Updated unpacked x64 portable -> ${unpackedDir}`)
    }
  } finally {
    fs.rmSync(stageDir, { recursive: true, force: true })
  }
}
