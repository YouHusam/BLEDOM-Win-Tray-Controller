import type {
  DeviceState,
  BleDeviceSummary,
  SavedDevice,
  CustomPreset
} from "../shared/ipc";

declare global {
  interface Window {
    controller: {
      setPower: (powerOn: boolean) => Promise<DeviceState>;
      setColor: (hexColor: string) => Promise<DeviceState>;
      getState: () => Promise<DeviceState>;
      discoverDevices: () => Promise<BleDeviceSummary[]>;
      saveSelectedDevice: (device: SavedDevice | null) => Promise<DeviceState>;
      getSelectedDevice: () => Promise<SavedDevice | null>;
      getCustomPresets: () => Promise<CustomPreset[]>;
      saveCustomPresets: (presets: CustomPreset[]) => Promise<CustomPreset[]>;
      increaseBrightness: () => Promise<DeviceState>;
      decreaseBrightness: () => Promise<DeviceState>;
      onState: (listener: (state: DeviceState) => void) => () => void;
    };
  }
}

export {};
