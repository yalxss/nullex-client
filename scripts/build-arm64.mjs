import { execSync } from 'node:child_process'

console.log('Building Nullex Client for Windows ARM64...')
const env = {
  ...process.env,
  PATH: `C:\\Program Files\\LLVM\\bin;${process.env.PATH || ''}`,
}

execSync('pnpm tauri build --target aarch64-pc-windows-msvc', {
  stdio: 'inherit',
  shell: true,
  env,
})
console.log('Windows ARM64 build finished successfully.')
