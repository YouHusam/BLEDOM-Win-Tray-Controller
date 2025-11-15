# BLELKDOM Tray Controller

Minimal Windows tray experience (inspired by Twinkle Tray) built on Electron + TypeScript for controlling BLELKDOM Bluetooth LED strips. The current build focuses on a compact acrylic-like flyout with first-run device pairing, a cached selection, and quick power/color presets that talk to the same FFF0/FFF3 characteristic combo used in [FreekBes/bledom_controller](https://github.com/FreekBes/bledom_controller).

## Features

- Frameless tray flyout styled after modern Windows quick settings
- Power toggle and three preset buttons mapped to RGB values
- First-run Bluetooth scan with cached device selection and automatic reconnect each time you open the tray
- Shared IPC contract and preload bridge with strict TypeScript types
- BLE stack backed by `@abandonware/noble` with an automatic fallback simulator when no adapter/drivers are present

## Project structure

```
src/
  main/          # Electron main process, tray + window orchestration
  preload/       # Context bridge exposing safe control API to renderer
  renderer/      # Acrylic-like UI rendered in the tray flyout
  shared/        # IPC constants and shared types
```

## Prerequisites

- Node.js 18+ (includes npm). Install from https://nodejs.org if the `node`/`npm` commands are not available in your shell yet.
- Windows 10/11 with Bluetooth hardware enabled (the tray UI still runs without it, but device scans will fall back to the simulator).
- Native build tooling required by `@abandonware/noble`:
  - Visual Studio Build Tools 2019+ with “Desktop development with C++” or `npm install --global --production windows-build-tools` (admin PowerShell).
  - Python 3 for node-gyp (ships with the build-tools option above).

## Getting started

```powershell
npm install
npm run dev
```

The `dev` script compiles TypeScript in watch mode, mirrors renderer assets, waits for `dist/main/main.js`, and launches Electron so you can iterate quickly. The flyout hides itself when it loses focus—click the tray icon to toggle it again.

### First run

1. Launch `npm run dev` and click the tray icon.
2. Hit **Scan** in the “Device” card; your BLELKDOM strip should appear (service `0000fff0-0000-1000-8000-00805f9b34fb`).
3. Select the device once. The choice is cached via `electron-store`; every time you reopen the tray, the app reconnects automatically and disconnects when you close/blur the flyout.
4. Use the power toggle or RGB presets. When no hardware is available, the simulator still produces UI feedback so you can continue iterating on layouts.

To produce a clean build once:

```powershell
npm run build
npm start
```

## Wiring real BLE commands

`src/main/ble/BlelkdomClient.ts` now bundles both behaviors:

1. When `@abandonware/noble` loads successfully, it scans for BLELKDOM peripherals (service `FFF0`) and writes the same `0x7e…0xef` packets as the reference web app.
2. When noble fails to load (no adapter or missing build prerequisites), it falls back to a deterministic simulator so the renderer + IPC layers can still be exercised.

The implementation intentionally mirrors the packet formats from [FreekBes/bledom_controller](https://github.com/FreekBes/bledom_controller) for color and brightness control. To extend it:

1. Map additional characteristics or effects by appending helper methods that call `writeCommand()` with the appropriate payloads.
2. Refine discovery/selection (e.g., multi-device support, RSSI sorting) by editing the `discoverDevices` helper.
3. Layer more presets or brightness sliders in the renderer once the BLE plumbing is stable.

## Next steps

- Integrate a full preset editor, brightness slider, and automation scenes.
- Surface troubleshooting info (adapter state, last error) directly in the flyout.
- Ship installers via `electron-builder` once BLE support is validated.
