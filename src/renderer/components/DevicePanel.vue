<template>
  <section class="card device-panel" :class="{ 'device-panel--needs-selection': !state?.selectedDevice }">
    <div class="card-row">
      <div>
        <p class="label">Device</p>
        <p class="device-status">{{ deviceStatus }}</p>
      </div>
      <button class="ghost-button" type="button" :disabled="scanning" @click="$emit('scan')">
        {{ scanning ? "Scanning…" : state?.selectedDevice ? "Rescan" : "Scan" }}
      </button>
    </div>
    <div class="device-list" role="listbox" aria-label="Available BLE devices">
      <template v-if="devices.length">
        <button
          v-for="device in devices"
          :key="device.id"
          class="device-item"
          type="button"
          :class="{ active: state?.selectedDevice?.id === device.id }"
          @click="handleSelection(device)"
        >
          <span class="device-name">{{ device.name || "Unnamed device" }}</span>
          <span v-if="formatMeta(device)" class="device-meta">{{ formatMeta(device) }}</span>
        </button>
      </template>
      <p v-else class="device-empty">{{ scanning ? "Scanning…" : "No BLE strips discovered yet" }}</p>
    </div>
    <p class="device-hint">
      Pick your LED strip once — we remember it and reconnect every time you open the tray.
    </p>
  </section>
</template>

<script setup lang="ts">
import { computed } from "vue";
import type { BleDeviceSummary, DeviceState, SavedDevice } from "../../shared/ipc";

const props = defineProps<{
  state: DeviceState | null;
  devices: BleDeviceSummary[];
  scanning: boolean;
}>();

const emit = defineEmits<{ (event: "scan"): void; (event: "select-device", payload: SavedDevice): void }>();

const deviceStatus = computed(() => {
  if (!props.state?.selectedDevice) {
    return props.scanning ? "Scanning for BLE strips…" : "Select a BLE strip to begin";
  }
  if (props.state.connected) {
    return `Connected to ${props.state.selectedDevice.name}`;
  }
  return `Saved device: ${props.state.selectedDevice.name}`;
});

function formatMeta(device: BleDeviceSummary): string {
  const signal = typeof device.rssi === "number" ? `RSSI ${device.rssi} dBm` : "";
  if (device.address) {
    return signal ? `${device.address} · ${signal}` : device.address;
  }
  return signal;
}

function handleSelection(device: BleDeviceSummary): void {
  emit("select-device", {
    id: device.id,
    name: device.name,
    address: device.address ?? null
  });
}
</script>
*** End of File