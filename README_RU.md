# Nullex Client

<p align="center">
  <img src="./src-tauri/icons/icon.png" alt="Nullex" width="128" />
  <br>
  <br>
  <a href="https://github.com/yalxss/nullex-client/releases">
    <img src="https://img.shields.io/github/v/release/yalxss/nullex-client?style=flat-square">
  </a>
</p>

<h3 align="center">GUI клиент для <a href="https://github.com/MetaCubeX/mihomo">Mihomo</a></h3>

<p align="center">
  <a href="README.md">English</a> • <a href="README_RU.md">Русский</a>
</p>

## Возможности

- [x] **Легкий и быстрый:** Построен на Rust и Tauri 2, потребляет всего ~15 МБ ОЗУ
- [x] **TUN-режим:** Маршрутизация всего системного трафика через виртуальный сетевой адаптер
- [x] **Протоколы:** VLESS (Reality), Hysteria 2, TUIC v5, Shadowsocks, WireGuard, Trojan
- [x] **Встроенное ядро:** Интегрированное ядро Mihomo и автоматическое обновление профилей
- [x] **Нативная поддержка:** Оптимизировано под Windows x64 и ARM64
- [x] **Тест задержки:** Быстрое измерение задержки узлов и пинга (TCP / HTTP)

## Скриншоты

<p align="center">
  <img src="./docs/preview.png" alt="Интерфейс Nullex" width="900" />
</p>

## Загрузки

Скачайте актуальную версию со страницы [GitHub Releases](https://github.com/yalxss/nullex-client/releases/latest):

| Файл | Пакет | Архитектура | Описание |
|---|---|---|---|
| `Nullex_1.1.0_x64-setup.exe` | Установщик | Windows x64 | Стандартный установщик с ярлыками на рабочем столе |
| `Nullex_x64-portable.7z` | Портативная версия | Windows x64 | Портативный архив, не требует установки |
| `Nullex_1.1.0_arm64-setup.exe` | Установщик | Windows ARM64 | Нативный установщик для Windows ARM64 |
| `Nullex_arm64-portable.7z` | Портативная версия | Windows ARM64 | Портативная версия для Windows ARM64 |

## Разработка

```bash
git clone https://github.com/yalxss/nullex-client.git
cd nullex-client
pnpm install
pnpm dev
```

Сборка релизных версий:

```bash
# Windows x64
pnpm tauri build --target x86_64-pc-windows-msvc

# Windows ARM64
node scripts/build-arm64.mjs
```

## Лицензия

Распространяется под лицензией [GPL-3.0](LICENSE).
