# Nullex Client

<p align="center">
  <img src="./src-tauri/icons/icon.png" alt="Nullex" width="128" />
  <br>
  <br>
  <a href="https://github.com/yalxss/nullex-client/releases">
    <img src="https://img.shields.io/github/v/release/yalxss/nullex-client?style=flat-square">
  </a>
</p>

<h3 align="center">GUI client for <a href="https://github.com/MetaCubeX/mihomo">Mihomo</a></h3>

<p align="center">
  <a href="README.md">English</a> • <a href="README_RU.md">Русский</a>
</p>

## Features

- [x] **Lightweight & Fast:** Built on Rust & Tauri 2, consuming only ~15 MB RAM
- [x] **TUN Mode:** Route all system network traffic through a virtual adapter
- [x] **Protocols:** VLESS (Reality), Hysteria 2, TUIC v5, Shadowsocks, WireGuard, Trojan
- [x] **Built-in Core:** Integrated Mihomo core with automatic profile management
- [x] **Native Support:** Optimized for Windows x64 and ARM64
- [x] **Latency Benchmark:** Fast node latency and ping testing (TCP / HTTP)

## Screenshots

<p align="center">
  <img src="./docs/preview.png" alt="Nullex Interface" width="900" />
</p>

## Downloads

Download the latest version from [GitHub Releases](https://github.com/yalxss/nullex-client/releases/latest):

| File | Package | Architecture | Description |
|---|---|---|---|
| `Nullex_1.1.0_x64-setup.exe` | Installer | Windows x64 | Standard installer with desktop shortcuts |
| `Nullex_x64-portable.7z` | Portable | Windows x64 | Portable archive, zero installation required |
| `Nullex_1.1.0_arm64-setup.exe` | Installer | Windows ARM64 | Native installer for Windows ARM64 devices |
| `Nullex_arm64-portable.7z` | Portable | Windows ARM64 | Native ARM64 portable archive |

## Development

```bash
git clone https://github.com/yalxss/nullex-client.git
cd nullex-client
pnpm install
pnpm dev
```

To build production binaries:

```bash
# Windows x64
pnpm tauri build --target x86_64-pc-windows-msvc

# Windows ARM64
node scripts/build-arm64.mjs
```

## License

Distributed under the [GPL-3.0 License](LICENSE).
