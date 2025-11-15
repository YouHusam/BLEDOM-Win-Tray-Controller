import { contextBridge, ipcRenderer, IpcRendererEvent } from "electron";
import {
  DeviceState,
  IPC_CHANNELS,
  type BleDeviceSummary,
  type SavedDevice,
  type CustomPreset
} from "../shared/ipc.js";

const api = {
  setPower: (powerOn: boolean): Promise<DeviceState> => {
    return ipcRenderer.invoke(IPC_CHANNELS.POWER, powerOn);
  },
  setColor: (hexColor: string): Promise<DeviceState> => {
    return ipcRenderer.invoke(IPC_CHANNELS.COLOR, hexColor);
  },
  getState: (): Promise<DeviceState> => {
    return ipcRenderer.invoke(IPC_CHANNELS.QUERY_STATE);
  },
  discoverDevices: (): Promise<BleDeviceSummary[]> => {
    console.log("[Preload] Invoking DISCOVER_DEVICES...");
    return ipcRenderer.invoke(IPC_CHANNELS.DISCOVER_DEVICES);
  },
  saveSelectedDevice: (device: SavedDevice | null): Promise<DeviceState> => {
    return ipcRenderer.invoke(IPC_CHANNELS.SAVE_SELECTED_DEVICE, device);
  },
  getSelectedDevice: (): Promise<SavedDevice | null> => {
    return ipcRenderer.invoke(IPC_CHANNELS.GET_SELECTED_DEVICE);
  },
  getCustomPresets: (): Promise<CustomPreset[]> => {
    return ipcRenderer.invoke(IPC_CHANNELS.GET_CUSTOM_PRESETS);
  },
  saveCustomPresets: (presets: CustomPreset[]): Promise<CustomPreset[]> => {
    return ipcRenderer.invoke(IPC_CHANNELS.SAVE_CUSTOM_PRESETS, presets);
  },
  increaseBrightness: (): Promise<DeviceState> => {
    return ipcRenderer.invoke(IPC_CHANNELS.BRIGHTNESS_UP);
  },
  decreaseBrightness: (): Promise<DeviceState> => {
    return ipcRenderer.invoke(IPC_CHANNELS.BRIGHTNESS_DOWN);
  },
  onState: (callback: (state: DeviceState) => void): (() => void) => {
    const listener = (_event: IpcRendererEvent, state: DeviceState) => callback(state);
    ipcRenderer.on(IPC_CHANNELS.STATE_UPDATE, listener);
    return () => ipcRenderer.removeListener(IPC_CHANNELS.STATE_UPDATE, listener);
  }
};

contextBridge.exposeInMainWorld("controller", api);

declare global {
  interface Window {
    controller: typeof api;
  }
}
