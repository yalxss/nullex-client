import { execSync } from 'node:child_process'
import { exportReleaseArtifacts } from './package-release.mjs'

console.log('Building Nullex Client for Windows x64...')
execSync('pnpm tauri build --target x86_64-pc-windows-msvc', {
  stdio: 'inherit',
  shell: true,
})
exportReleaseArtifacts({ target: 'x86_64-pc-windows-msvc', archLabel: 'x64' })
console.log('Windows x64 build finished successfully.')
