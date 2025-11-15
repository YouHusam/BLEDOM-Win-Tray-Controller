import Store from "electron-store";
import { type SavedDevice, type CustomPreset } from "../../shared/ipc.js";

type SettingsSchema = {
  selectedDevice?: SavedDevice | null;
  lastColor?: string; // hex color
  lastPowerOn?: boolean;
  customPresets?: CustomPreset[];
};

export const settingsStore = new Store<SettingsSchema>({
  name: "bt-control",
  defaults: {
    lastColor: "#ff0000",
    lastPowerOn: false,
    customPresets: []
  }
});

export function getSelectedDevice(): SavedDevice | null {
  return settingsStore.get("selectedDevice", null);
}

export function setSelectedDevice(device: SavedDevice | null): void {
  settingsStore.set("selectedDevice", device);
}

export function getLastState(): { color: string; powerOn: boolean } {
  return {
    color: settingsStore.get("lastColor", "#ff0000"),
    powerOn: settingsStore.get("lastPowerOn", false)
  };
}

export function persistState(color: string, powerOn: boolean): void {
  settingsStore.set("lastColor", color);
  settingsStore.set("lastPowerOn", powerOn);
}

export function getCustomPresets(): CustomPreset[] {
  return settingsStore.get("customPresets", []);
}

export function saveCustomPresets(presets: CustomPreset[]): void {
  settingsStore.set("customPresets", presets);
}
