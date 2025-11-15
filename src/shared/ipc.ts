export const IPC_CHANNELS = {
  POWER: "ble:set-power",
  COLOR: "ble:set-color",
  QUERY_STATE: "ble:get-state",
  STATE_UPDATE: "ble:state-update",
  DISCOVER_DEVICES: "ble:discover-devices",
  SAVE_SELECTED_DEVICE: "ble:save-device",
  GET_SELECTED_DEVICE: "ble:get-selected-device",
  BRIGHTNESS_UP: "ble:brightness-up",
  BRIGHTNESS_DOWN: "ble:brightness-down",
  GET_CUSTOM_PRESETS: "presets:get-custom",
  SAVE_CUSTOM_PRESETS: "presets:save-custom"
} as const;

export type DeviceState = {
  powerOn: boolean;
  color: string; // hex color like "#ff0000"
  brightness: number;
  connected: boolean;
  selectedDevice: SavedDevice | null;
};

export type BleDeviceSummary = {
  id: string;
  name: string;
  address?: string | null;
  rssi?: number | null;
};

export type SavedDevice = {
  id: string;
  name: string;
  address?: string | null;
};

export type CustomPreset = {
  id: string;
  label: string;
  color: string; // hex color like "#ff0000"
};
