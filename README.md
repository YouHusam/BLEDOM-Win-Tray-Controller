# WARNING: VIBE CODE AHEAD

While I am an experienced developer I was too lazy to write my own code, so this is mostly written by GPT-5.1-Codex and Claude Sonnet 4.5

# BLELKDOM Tray Controller

Electron + Vue tray utility for controlling BLELKDOM LED strips from Windows. It mirrors the quick-settings flyout aesthetic, remembers the last paired device, and exposes power, presets, brightness, and custom colors through a compact UI backed by typed IPC contracts.

## Highlights

- Modern renderer stack (Vite + Vue 3 + TypeScript) with card-based components (`PowerCard`, `BrightnessCard`, `CustomColorCard`, `PresetList`).
- BLE client built on `@abandonware/noble`, matching the `FFF0/FFF3` command pattern documented by [FreekBes/bledom_controller](https://github.com/FreekBes/bledom_controller).
- Automatic reconnect using `electron-store` to persist the selected peripheral and custom presets.
- Simulator fallback keeps the UI interactive when no adapter or drivers are present.
- Strictly typed shared IPC surface via `src/shared/ipc.ts` and a preload bridge that only exposes the safe control API.

## Repository layout

```
src/
  main/          # Electron main process, BLE client, tray + window lifecycle
  preload/       # Context-bridge exposing typed controller methods to the UI
  renderer/      # Vue SPA rendered inside the tray flyout
  renderer/components/  # Reusable cards for power, presets, brightness, custom colors
  renderer/views/       # App screens (scan + control)
  shared/        # IPC channels, DTOs, and TypeScript helpers
resources/       # Icons and static assets bundled with Electron
```

## Requirements

- Windows 10/11 with Bluetooth enabled.
- Node.js 18+ (ships with npm).
- Native toolchain for `@abandonware/noble` (`npm install --global windows-build-tools` or Visual Studio Build Tools + Python 3).

## Install & run

```powershell
npm install
npm run dev
```

The dev script builds the preload/renderer in watch mode and restarts Electron once the main bundle is ready. The flyout hides when it loses focus—click the tray icon again to toggle it.

### Pairing flow

1. Start `npm run dev` and click the tray icon to open the flyout.
2. Use the **Scan** button in the device card; BLELKDOM peripherals broadcasting service `FFF0` should appear.
3. Select the strip once. The selection and any custom presets persist via `electron-store`.
4. From the control view you can toggle power, adjust brightness, pick from built-in presets, or create your own color + label combo.

### Production build

```powershell
npm run build
npm start
```

`npm run build` produces optimized main, preload, and renderer bundles inside `dist/`. Running `npm start` after the build launches Electron using those artifacts.

## BLE + simulator behavior

- `src/main/ble/BlelkdomClient.ts` first attempts to initialize `@abandonware/noble` and scan for devices with service UUID `0000fff0-0000-1000-8000-00805f9b34fb`.
- If initialization fails, the client falls back to a deterministic simulator so the renderer continues to receive state updates (useful for UI work without hardware).
- Commands dispatched from the renderer are encoded with the same `0x7e … 0xef` packets as the reference controller, covering power, color, and brightness.

## Development notes

- Renderer is a Vite + Vue 3 app; modify `src/renderer` components to iterate on the UI. Scoped styles live next to their components, with shared variables in `src/renderer/styles.css`.
- IPC contracts and DTOs reside in `src/shared/ipc.ts`; update both main and renderer imports when adding new commands/events.
- Persistent settings (selected device, custom presets) are managed via `src/main/store/settings.ts` using `electron-store`.
- Tests are currently manual; run `npm run dev` for hot reload or `npm run build` for release validation.

## Roadmap ideas

- Display adapter/driver diagnostics directly in the flyout.
- Multi-device management and quick swapping.
- Packaged installer via `electron-builder` once BLE stability is confirmed.
