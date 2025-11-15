import path from "path";
import { fileURLToPath } from "url";
import {
  app,
  BrowserWindow,
  Tray,
  Menu,
  nativeImage,
  ipcMain,
  shell,
  screen,
  type Rectangle,
  type IpcMainInvokeEvent
} from "electron";
import { BlelkdomClient } from "./ble/BlelkdomClient.js";
import { getCustomPresets, saveCustomPresets } from "./store/settings.js";
import {
  DeviceState,
  IPC_CHANNELS,
  type SavedDevice,
  type CustomPreset
} from "../shared/ipc.js";

const WINDOW_SIZE = { width: 320, height: 600 };

type WindowLifecycle = {
  onShow?: () => void;
  onHide?: () => void;
};

class ControlWindow {
  private window: BrowserWindow | null = null;

  constructor(private ble: BlelkdomClient, private lifecycle?: WindowLifecycle) { }

  init(): void {
    console.log('[ControlWindow] Initializing window...');
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);
    console.log('[ControlWindow] __dirname:', __dirname);
    const iconPath = path.join(__dirname, "../../resources/icon.png");
    this.window = new BrowserWindow({
      width: WINDOW_SIZE.width,
      height: WINDOW_SIZE.height,
      show: false,
      frame: false,
      resizable: false,
      alwaysOnTop: true,
      skipTaskbar: true,
      transparent: false,
      backgroundColor: "#1e1e1e",
      icon: iconPath,
      webPreferences: {
        preload: path.join(__dirname, "../preload/index.js"),
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: false,
        devTools: true
      }
    });

    this.window.webContents.on('did-finish-load', () => {
      console.log('[ControlWindow] Renderer finished loading');
    });

    this.window.on('ready-to-show', () => {
      console.log('[ControlWindow] Window ready to show');
    });

    this.window.on("blur", () => {
      if (!this.window) {
        return;
      }
      this.window.hide();
      this.lifecycle?.onHide?.();
    });

    const rendererPath = path.join(__dirname, "../renderer/index.html");
    console.log('[ControlWindow] Loading renderer from:', rendererPath);
    this.window.loadFile(rendererPath).catch((err) => {
      console.error('[ControlWindow] Failed to load renderer:', err);
    });
  }

  toggle(trayBounds: Rectangle): void {
    console.log('[ControlWindow] Toggle called, window exists:', !!this.window, 'visible:', this.window?.isVisible());
    if (!this.window) {
      return;
    }

    if (this.window.isVisible()) {
      this.window.hide();
      this.lifecycle?.onHide?.();
      return;
    }

    const display = screen.getDisplayNearestPoint({
      x: trayBounds.x,
      y: trayBounds.y
    });

    console.log('[ControlWindow] Display work area:', display.workArea);

    const x = Math.round(
      trayBounds.x + trayBounds.width / 2 - WINDOW_SIZE.width / 2
    );
    const y = Math.round(
      display.workArea.y + display.workArea.height - WINDOW_SIZE.height - 8
    );

    console.log('[ControlWindow] Setting position to:', { x, y });
    this.window.setPosition(x, y, false);
    console.log('[ControlWindow] Calling show()...');
    this.window.show();
    console.log('[ControlWindow] Window shown, isVisible:', this.window.isVisible());
    console.log('[ControlWindow] Calling focus()...');
    this.window.focus();
    console.log('[ControlWindow] Window bounds:', this.window.getBounds());
    this.lifecycle?.onShow?.();
    this.window.webContents.send(IPC_CHANNELS.STATE_UPDATE, this.ble.getState());
  }

  sendState(state: DeviceState): void {
    this.window?.webContents.send(IPC_CHANNELS.STATE_UPDATE, state);
  }
}

class TrayController {
  private tray: Tray | null = null;

  constructor(private controlWindow: ControlWindow) { }

  init(): void {
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);
    const iconPath = path.join(__dirname, "../../resources/icon.png");
    const icon = nativeImage.createFromPath(iconPath);
    icon.resize({ width: 16, height: 16 });

    this.tray = new Tray(icon);
    this.tray.setToolTip("BLELKDOM Control");

    const contextMenu = Menu.buildFromTemplate([
      {
        label: "Show",
        click: () => this.toggleWindow()
      },
      { type: "separator" },
      {
        label: "Exit",
        click: () => {
          app.quit();
        }
      }
    ]);

    this.tray.setContextMenu(contextMenu);
    console.log('[TrayController] Adding click listener...');
    this.tray.addListener("click", () => {
      console.log('[TrayController] Tray clicked!');
      this.toggleWindow();
    });
  }

  private toggleWindow(): void {
    console.log('[TrayController] toggleWindow called');
    if (!this.tray) {
      console.log('[TrayController] No tray instance');
      return;
    }

    const bounds = this.tray.getBounds();
    console.log('[TrayController] Tray bounds:', bounds);
    this.controlWindow.toggle(bounds);
  }
}

const bleClient = new BlelkdomClient();
const controlWindow = new ControlWindow(bleClient, {
  onShow: () => {
    void bleClient.connectToSavedDevice().catch((error: unknown) => {
      console.error("Failed to connect to BLELKDOM strip", error);
    });
  },
  onHide: () => {
    void bleClient.disconnect().catch((error: unknown) => {
      console.error("Failed to disconnect from BLELKDOM strip", error);
    });
  }
});
const trayController = new TrayController(controlWindow);

function registerIpc(): void {
  ipcMain.handle(IPC_CHANNELS.POWER, async (_event: IpcMainInvokeEvent, powerOn: boolean) => {
    await bleClient.setPower(powerOn);
    return bleClient.getState();
  });

  ipcMain.handle(IPC_CHANNELS.COLOR, async (_event: IpcMainInvokeEvent, hexColor: string) => {
    await bleClient.setColor(hexColor);
    return bleClient.getState();
  });

  ipcMain.handle(IPC_CHANNELS.QUERY_STATE, async () => bleClient.getState());

  ipcMain.handle(IPC_CHANNELS.DISCOVER_DEVICES, async () => {
    console.log("[Main] DISCOVER_DEVICES handler invoked");
    const devices = await bleClient.discoverDevices();
    console.log("[Main] Discovery complete, returning", devices.length, "device(s)");
    return devices;
  });

  ipcMain.handle(IPC_CHANNELS.SAVE_SELECTED_DEVICE, async (_event: IpcMainInvokeEvent, device: SavedDevice | null) => {
    return bleClient.saveSelectedDevice(device);
  });

  ipcMain.handle(IPC_CHANNELS.GET_SELECTED_DEVICE, async () => bleClient.getState().selectedDevice);

  ipcMain.handle(IPC_CHANNELS.BRIGHTNESS_UP, async () => {
    await bleClient.increaseBrightness();
    return bleClient.getState();
  });

  ipcMain.handle(IPC_CHANNELS.BRIGHTNESS_DOWN, async () => {
    await bleClient.decreaseBrightness();
    return bleClient.getState();
  });

  ipcMain.handle(IPC_CHANNELS.GET_CUSTOM_PRESETS, async () => {
    const presets = getCustomPresets();
    console.log('[Main] GET_CUSTOM_PRESETS returning:', presets);
    return presets;
  });

  ipcMain.handle(IPC_CHANNELS.SAVE_CUSTOM_PRESETS, async (_event: IpcMainInvokeEvent, presets: CustomPreset[]) => {
    console.log('[Main] SAVE_CUSTOM_PRESETS received:', presets);
    saveCustomPresets(presets);
    const saved = getCustomPresets();
    console.log('[Main] SAVE_CUSTOM_PRESETS verified:', saved);
    return saved;
  });

  bleClient.onStateChanged((state: DeviceState) => {
    controlWindow.sendState(state);
  });
}

app.on("ready", async () => {
  console.log('[App] Ready event fired');
  controlWindow.init();
  console.log('[App] Control window initialized');
  trayController.init();
  console.log('[App] Tray initialized');
  registerIpc();
  console.log('[App] IPC registered');
  
  // Try to auto-connect to saved device, but don't fail startup if it doesn't work
  bleClient.connectToSavedDevice().catch((error) => {
    console.log('[App] Auto-connect failed (this is normal on first run):', error.message);
  });
  
  console.log('[App] Initialization complete');
});

app.on("before-quit", () => {
  bleClient.disconnect().catch(() => undefined);
});

const MONO_ICON_DATA_URL =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAV0lEQVQ4T2NkIBIwEqmOQvwPxBiDA8P///9LS0vBGJYBNRmIyGQTiAFS0uLiYoAZHYg2JBpAnhA1gYg2Q5QBwYGCALRBTI64BiZKpAC7ApEMgGoGAAF7qhxUp3NEQAAAABJRU5ErkJggg==";
