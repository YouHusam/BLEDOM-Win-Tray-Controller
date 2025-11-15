import type { Characteristic, Peripheral } from "@abandonware/noble";
import {
  type BleDeviceSummary,
  type DeviceState,
  type SavedDevice
} from "../../shared/ipc.js";
import {
  getLastState,
  getSelectedDevice,
  persistState,
  setSelectedDevice
} from "../store/settings.js";

type NobleModule = typeof import("@abandonware/noble");
let noble: NobleModule | null = null;

async function loadNoble(): Promise<NobleModule | null> {
  try {
    const nobleModule = await import("@abandonware/noble");
    // Handle both default and named exports
    return (nobleModule.default || nobleModule) as NobleModule;
  } catch (error) {
    console.warn("@abandonware/noble was not loaded; falling back to simulation mode", error);
    return null;
  }
}

const noblePromise = loadNoble();

const SERVICE_UUID = "0000fff0-0000-1000-8000-00805f9b34fb";
const SERVICE_UUID_SHORT = "fff0";
const CHARACTERISTIC_UUID = "0000fff3-0000-1000-8000-00805f9b34fb";
const CHARACTERISTIC_UUID_SHORT = "fff3";

type ScanAttempt = {
  label: string;
  uuids: string[];
};

const SCAN_ATTEMPTS: ScanAttempt[] = [
  { label: "unfiltered", uuids: [] },
  { label: "blelkdom-service", uuids: [SERVICE_UUID_SHORT] }
];

type Listener<T> = (payload: T) => void;

export class BlelkdomClient {
  private state: DeviceState;
  private simulationMode = true;
  private characteristic: Characteristic | null = null;
  private peripheral: Peripheral | null = null;
  private connectPromise: Promise<void> | null = null;
  private stateListeners: Listener<DeviceState>[] = [];
  private connectionListeners: Listener<boolean>[] = [];
  private lastDiscovery = new Map<string, BleDeviceSummary>();
  private nobleReady = false;

  constructor() {
    const { color, powerOn } = getLastState();
    const selectedDevice = getSelectedDevice();
    this.state = {
      powerOn,
      color, // hex string like "#ff0000"
      brightness: 100,
      connected: false,
      selectedDevice: selectedDevice ?? null
    };
    
    // Initialize noble asynchronously
    noblePromise.then((nobleModule) => {
      if (nobleModule) {
        noble = nobleModule;
        this.simulationMode = false;
        this.nobleReady = true;
        console.log('[BLE] Noble loaded successfully');
      } else {
        console.log('[BLE] Running in simulation mode');
      }
    });
  }

  getState(): DeviceState {
    return {
      powerOn: this.state.powerOn,
      color: this.state.color,
      brightness: this.state.brightness,
      connected: this.state.connected,
      selectedDevice: this.state.selectedDevice ? { ...this.state.selectedDevice } : null
    };
  }

  onStateChanged(listener: Listener<DeviceState>): () => void {
    this.stateListeners.push(listener);
    return () => {
      this.stateListeners = this.stateListeners.filter((fn) => fn !== listener);
    };
  }

  onConnectionChanged(listener: Listener<boolean>): () => void {
    this.connectionListeners.push(listener);
    return () => {
      this.connectionListeners = this.connectionListeners.filter((fn) => fn !== listener);
    };
  }

  async discoverDevices(timeoutMs = 8000): Promise<BleDeviceSummary[]> {
    console.log("[BLE] discoverDevices called, timeoutMs=", timeoutMs);
    if (this.simulationMode) {
      console.log("[BLE] Simulation mode active, returning fake device");
      const fake = [{ id: "simulated-led", name: "Simulated BLE Strip" }];
      fake.forEach((device) => this.lastDiscovery.set(device.id, device));
      return fake;
    }

    await this.waitForAdapterReady();
    console.log("[BLE] Adapter ready, starting scan attempts");

    const aggregated = new Map<string, BleDeviceSummary>();
    for (const attempt of SCAN_ATTEMPTS) {
      console.log(`[BLE] Attempting scan: ${attempt.label}, filters:`, attempt.uuids);
      const found = await this.runDiscoveryAttempt(attempt, timeoutMs);
      console.log(`[BLE] Scan attempt ${attempt.label} found ${found.size} device(s)`);
      found.forEach((device, id) => aggregated.set(id, device));
      if (aggregated.size > 0) {
        break;
      }
    }

    if (aggregated.size === 0 && this.lastDiscovery.size > 0) {
      console.log("[BLE] No new devices, returning", this.lastDiscovery.size, "cached device(s)");
      return Array.from(this.lastDiscovery.values());
    }

    console.log("[BLE] Returning", aggregated.size, "device(s)");
    return Array.from(aggregated.values());
  }

  async saveSelectedDevice(device: SavedDevice | null): Promise<DeviceState> {
    setSelectedDevice(device);
    this.state.selectedDevice = device ? { ...device } : null;
    if (!device) {
      await this.disconnect();
    }
    this.emitState();
    return this.getState();
  }

  async connectToSavedDevice(): Promise<void> {
    if (this.state.connected || this.connectPromise) {
      await this.connectPromise;
      return;
    }

    const target = this.state.selectedDevice;
    console.log('[BLE] connectToSavedDevice - target:', target);
    if (!target) {
      return;
    }

    if (this.simulationMode) {
      await this.simulateLatency();
      this.state.connected = true;
      this.emitConnection(true);
      this.emitState();
      return;
    }

    if (!noble) {
      throw new Error("Bluetooth stack is unavailable");
    }

      this.connectPromise = (async () => {
        await this.waitForAdapterReady();
        console.log('[BLE] Starting search for saved device:', target);
        const peripheral = await this.findPeripheralForSavedDevice(target, 12000);
        console.log('[BLE] Found peripheral:', peripheral.id);
        await this.attachPeripheral(peripheral);
      })();

    try {
      await this.connectPromise;
    } finally {
      this.connectPromise = null;
    }
  }

  async disconnect(): Promise<void> {
    if (this.simulationMode) {
      if (this.state.connected) {
        this.state.connected = false;
        this.emitConnection(false);
        this.emitState();
      }
      return;
    }

    if (this.connectPromise) {
      try {
        await this.connectPromise;
      } catch {
        // no-op – we only wait for the attempt to settle
      }
    }

    if (this.peripheral) {
      const target = this.peripheral;
      this.peripheral = null;
      this.characteristic = null;
      await target.disconnectAsync().catch(() => undefined);
    }

    if (this.state.connected) {
      this.state.connected = false;
      this.emitConnection(false);
      this.emitState();
    }
  }

  async setPower(on: boolean): Promise<void> {
    await this.ensureConnected();
    if (on) {
      await this.writeCommand(this.buildPowerOnCommand());
    } else {
      await this.writeCommand(this.buildPowerOffCommand());
    }
    this.state.powerOn = on;
    persistState(this.state.color, this.state.powerOn);
    this.emitState();
  }

  async increaseBrightness(): Promise<void> {
    await this.ensureConnected();
    const currentBrightness = this.state.brightness ?? 100;
    const newBrightness = Math.min(100, currentBrightness + 10);
    await this.writeCommand(this.buildBrightnessCommand(newBrightness));
    this.state.brightness = newBrightness;
    this.emitState();
  }

  async decreaseBrightness(): Promise<void> {
    await this.ensureConnected();
    const currentBrightness = this.state.brightness ?? 100;
    const newBrightness = Math.max(0, currentBrightness - 10);
    await this.writeCommand(this.buildBrightnessCommand(newBrightness));
    this.state.brightness = newBrightness;
    this.emitState();
  }

  async setColor(hexColor: string): Promise<void> {
    await this.ensureConnected();
    await this.writeCommand(this.buildColorCommand(hexColor));
    this.state.color = hexColor;
    this.state.powerOn = true;
    persistState(this.state.color, this.state.powerOn);
    this.emitState();
  }

  private async ensureConnected(): Promise<void> {
    if (!this.state.selectedDevice) {
      throw new Error("Select a BLELKDOM strip first");
    }
    if (!this.state.connected) {
      await this.connectToSavedDevice();
    }
  }

  private async waitForAdapterReady(): Promise<void> {
    if (!noble) {
      return;
    }

    if (noble._state === "poweredOn") {
      return;
    }

    await new Promise<void>((resolve, reject) => {
      if (!noble) {
        reject(new Error("Noble not available"));
        return;
      }
      const onStateChange = (state: string) => {
        if (state === "poweredOn") {
          noble?.removeListener("stateChange", onStateChange);
          resolve();
        } else if (state === "unauthorized" || state === "unsupported") {
          noble?.removeListener("stateChange", onStateChange);
          reject(new Error(`Bluetooth adapter state: ${state}`));
        }
      };
      noble.on("stateChange", onStateChange);
    });
  }

  private deviceMatches(peripheral: Peripheral): boolean {
    if (!peripheral?.advertisement) {
      return false;
    }

    if (this.hasTargetService(peripheral)) {
      return true;
    }

    const selected = this.state.selectedDevice;
    if (selected && this.peripheralMatchesSaved(peripheral, selected)) {
      return true;
    }

    const localName = peripheral.advertisement.localName;
    const hasManufacturer = Boolean(peripheral.advertisement.manufacturerData?.length);
    return Boolean(localName) || hasManufacturer || Boolean(peripheral.address);
  }

  private async runDiscoveryAttempt(attempt: ScanAttempt, timeoutMs: number): Promise<Map<string, BleDeviceSummary>> {
    const devices = new Map<string, BleDeviceSummary>();

    if (!noble) {
      return devices;
    }

    return new Promise((resolve, reject) => {
      let timer: NodeJS.Timeout | null = null;

      const onDiscover = (peripheral: Peripheral) => {
        if (!this.deviceMatches(peripheral)) {
          return;
        }
        const summary = this.toSummary(peripheral);
        devices.set(summary.id, summary);
        this.lastDiscovery.set(summary.id, summary);
      };

      const cleanup = () => {
        if (timer) {
          clearTimeout(timer);
          timer = null;
        }
        noble?.removeListener("discover", onDiscover);
        void noble?.stopScanningAsync().catch(() => undefined);
      };

      timer = setTimeout(() => {
        cleanup();
        resolve(devices);
      }, timeoutMs);

      if (!noble) {
        cleanup();
        reject(new Error("Noble not available"));
        return;
      }

      noble.on("discover", onDiscover);
      noble
        .startScanningAsync(attempt.uuids, false)
        .catch((error: Error) => {
          cleanup();
          reject(error);
        });
    });
  }

  private async findPeripheralForSavedDevice(target: SavedDevice, totalTimeoutMs: number): Promise<Peripheral> {
    if (!noble) {
      throw new Error("Bluetooth stack is unavailable");
    }

    const perAttempt = Math.max(3000, Math.floor(totalTimeoutMs / SCAN_ATTEMPTS.length));
    console.log('[BLE] findPeripheralForSavedDevice - looking for:', { id: target.id, name: target.name, address: target.address });

    // Try direct connection if we have the device ID
    if (this.lastDiscovery.has(target.id)) {
      console.log('[BLE] Device found in cache, attempting direct connection...');
      // Start a short scan to find the device
      for (const attempt of SCAN_ATTEMPTS) {
        try {
          console.log(`[BLE] Quick scan attempt: ${attempt.label}`);
          const peripheral = await this.runMatchAttempt(attempt, target, Math.min(perAttempt, 5000));
          if (peripheral) {
            console.log('[BLE] Match found via quick scan');
            return peripheral;
          }
        } catch (error) {
          console.warn(`[BLE] Quick scan failed (${attempt.label})`, error);
        }
      }
    }

    for (const attempt of SCAN_ATTEMPTS) {
      try {
        console.log(`[BLE] Trying scan attempt: ${attempt.label} (timeout: ${perAttempt}ms)`);
        const peripheral = await this.runMatchAttempt(attempt, target, perAttempt);
        if (peripheral) {
          console.log('[BLE] Match found:', { id: peripheral.id, name: peripheral.advertisement?.localName });
          return peripheral;
        }
        console.log(`[BLE] No match in attempt: ${attempt.label}`);
      } catch (error) {
        console.warn(`[BLE] Scan attempt failed (${attempt.label})`, error);
      }
    }

    console.error('[BLE] Saved device not found after all attempts');
    console.error('[BLE] Target was:', target);
    console.error('[BLE] Last discovery had:', Array.from(this.lastDiscovery.keys()));
    throw new Error("Saved device not found during scan attempts. Try rescanning and selecting the device again.");
  }

  private runMatchAttempt(
    attempt: ScanAttempt,
    target: SavedDevice,
    timeoutMs: number
  ): Promise<Peripheral | null> {
    if (!noble) {
      return Promise.resolve(null);
    }

    return new Promise((resolve, reject) => {
      let timer: NodeJS.Timeout | null = null;

      const onDiscover = (peripheral: Peripheral) => {
        const matches = this.peripheralMatchesSaved(peripheral, target);
        console.log('[BLE] Discovered:', {
          id: peripheral.id,
          name: peripheral.advertisement?.localName,
          address: peripheral.address,
          matches
        });
        if (!matches) {
          return;
        }
        console.log('[BLE] ✓ Match found!');
        cleanup();
        resolve(peripheral);
      };

      const cleanup = () => {
        if (timer) {
          clearTimeout(timer);
          timer = null;
        }
        noble?.removeListener("discover", onDiscover);
        void noble?.stopScanningAsync().catch(() => undefined);
      };

      timer = setTimeout(() => {
        cleanup();
        resolve(null);
      }, timeoutMs);

      if (!noble) {
        cleanup();
        reject(new Error("Noble not available"));
        return;
      }

      noble.on("discover", onDiscover);
      noble
        .startScanningAsync(attempt.uuids, false)
        .catch((error: Error) => {
          cleanup();
          reject(error);
        });
    });
  }

  private hasTargetService(peripheral: Peripheral): boolean {
    const serviceUuids = peripheral.advertisement?.serviceUuids || [];
    return serviceUuids.includes(SERVICE_UUID_SHORT) || serviceUuids.includes(SERVICE_UUID);
  }

  private toSummary(peripheral: Peripheral): BleDeviceSummary {
    return {
      id: peripheral.id,
      name: peripheral.advertisement?.localName || "Unnamed device",
      address: peripheral.address || null,
      rssi: peripheral.rssi ?? null
    };
  }

  private peripheralMatchesSaved(peripheral: Peripheral, saved: SavedDevice): boolean {
    const idMatch = peripheral.id === saved.id;
    const addressMatch = !!(saved.address && peripheral.address && 
      peripheral.address.toLowerCase() === saved.address.toLowerCase());
    const nameMatch = !!(saved.name && peripheral.advertisement?.localName && 
      peripheral.advertisement.localName.trim() === saved.name.trim());
    
    if (idMatch || addressMatch || nameMatch) {
      console.log('[BLE] Match criteria:', { 
        idMatch, 
        addressMatch, 
        nameMatch,
        peripheral: { id: peripheral.id, address: peripheral.address, name: peripheral.advertisement?.localName },
        saved: { id: saved.id, address: saved.address, name: saved.name }
      });
    }
    
    return idMatch || addressMatch || nameMatch;
  }

  private async attachPeripheral(peripheral: Peripheral): Promise<void> {
    const onDisconnect = () => {
      this.characteristic = null;
      this.peripheral = null;
      if (this.state.connected) {
        this.state.connected = false;
        this.emitConnection(false);
        this.emitState();
      }
    };

    peripheral.once("disconnect", onDisconnect);

    console.log('[BLE] Connecting to peripheral:', peripheral.id);
    await peripheral.connectAsync();
    console.log('[BLE] Connected, discovering services...');
    
    // Try discovering all services first to see what's available
    let characteristics: any[] = [];
    try {
      const result = await peripheral.discoverSomeServicesAndCharacteristicsAsync(
        [SERVICE_UUID, SERVICE_UUID_SHORT],
        [CHARACTERISTIC_UUID, CHARACTERISTIC_UUID_SHORT]
      );
      characteristics = result.characteristics || [];
      console.log('[BLE] Discovered characteristics:', characteristics.length);
    } catch (error) {
      console.log('[BLE] Failed to discover specific services, trying all services...', error);
      // Try discovering all services and characteristics
      const allResult = await peripheral.discoverAllServicesAndCharacteristicsAsync();
      console.log('[BLE] All services:', allResult.services?.map((s: any) => s.uuid));
      characteristics = allResult.characteristics || [];
      console.log('[BLE] All characteristics:', characteristics.map((c: any) => c.uuid));
      
      // Find the target characteristic manually
      characteristics = characteristics.filter((c: any) => 
        c.uuid === CHARACTERISTIC_UUID || c.uuid === CHARACTERISTIC_UUID_SHORT
      );
    }

    const targetCharacteristic = characteristics[0];
    if (!targetCharacteristic) {
      throw new Error("Unable to find BLELKDOM write characteristic");
    }
    console.log('[BLE] Using characteristic:', targetCharacteristic.uuid);
    this.characteristic = targetCharacteristic;
    this.peripheral = peripheral;
    this.state.connected = true;
    this.emitConnection(true);
    this.emitState();
  }

  private async writeCommand(bytes: number[]): Promise<void> {
    if (this.simulationMode) {
      await this.simulateLatency();
      return;
    }
    if (!this.characteristic) {
      throw new Error("No BLE characteristic is available");
    }
    const payload = Buffer.from(bytes);
    await this.characteristic.writeAsync(payload, false);
  }

  private hexToBytes(hex: string): [string, string, string] {
    const clean = hex.replace(/^#/, "");
    return [
      `0x${clean.slice(0, 2)}`,
      `0x${clean.slice(2, 4)}`,
      `0x${clean.slice(4, 6)}`
    ];
  }

  private buildColorCommand(hexColor: string): number[] {
    const [rHex, gHex, bHex] = this.hexToBytes(hexColor);
    const [rByte, gByte, bByte] = [rHex, gHex, bHex].map((value) => Number(value));
    console.log(`[BLE] buildColorCommand - hex: ${hexColor}, bytes: (${rHex}, ${gHex}, ${bHex})`);
    // return [0x7e, 0x00, 0x05, 0x03, r, g, b, 0x00, 0xef];
    return [0x7e, 0x07, 0x05, 0x03, rByte, gByte, bByte, 0x10, 0xef];
  }

  private buildPowerOnCommand(): number[] {
    return [0x7e, 0x00, 0x04, 0x01, 0x00, 0x00, 0x00, 0x00, 0xef];
  }

  private buildPowerOffCommand(): number[] {
    return [0x7e, 0x00, 0x04, 0x00, 0x00, 0x00, 0x00, 0x00, 0xef];
  }

  private buildBrightnessCommand(value: number): number[] {
    const level = Math.min(100, Math.max(0, value));
    return [0x7e, 0x00, 0x01, level, 0x00, 0x00, 0x00, 0x00, 0xef];
  }

  private emitState(): void {
    const snapshot = this.getState();
    this.stateListeners.forEach((listener) => listener(snapshot));
  }

  private emitConnection(connected: boolean): void {
    this.connectionListeners.forEach((listener) => listener(connected));
  }

  private async simulateLatency(): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, 180));
  }
}
