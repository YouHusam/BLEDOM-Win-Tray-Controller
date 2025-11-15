<template>
  <div class="shell">
    <StatusHeader :status-text="scanning ? 'Scanning...' : 'Select a Device'" />
    
    <div class="device-panel">
      <p class="label">Bluetooth Devices</p>
      <button class="ghost-button" @click="handleScan" :disabled="scanning">
        {{ scanning ? 'Scanning...' : 'Scan' }}
      </button>
      <p class="device-status">{{ deviceStatus }}</p>
      <div v-if="availableDevices.length > 0" class="device-list">
        <button
          v-for="device in availableDevices"
          :key="device.id"
          class="device-item"
          @click="handleDeviceSelection(device)"
        >
          <span class="device-name">{{ device.name || 'Unnamed device' }}</span>
          <span class="device-meta">{{ formatMeta(device) }}</span>
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { useRouter } from 'vue-router';
import StatusHeader from '../components/StatusHeader.vue';
import type { BleDeviceSummary } from '../../shared/ipc';

const router = useRouter();
const scanning = ref(false);
const availableDevices = ref<BleDeviceSummary[]>([]);

const deviceStatus = computed(() => {
  if (scanning.value) return 'Scanning for devices...';
  if (availableDevices.value.length > 0) return `Found ${availableDevices.value.length} device(s)`;
  return 'No devices found. Click Scan to search.';
});

function formatMeta(device: BleDeviceSummary): string {
  const parts: string[] = [];
  if (device.rssi) parts.push(`${device.rssi} dBm`);
  if (device.address) parts.push(device.address);
  return parts.join(' · ') || 'No details';
}

async function handleScan() {
  scanning.value = true;
  availableDevices.value = [];
  try {
    console.log('[ScanView] Starting device scan...');
    const devices = await window.controller.discoverDevices();
    availableDevices.value = devices;
    console.log('[ScanView] Scan complete, found', devices.length, 'devices');
  } catch (error) {
    console.error('[ScanView] Scan failed:', error);
  } finally {
    scanning.value = false;
  }
}

async function handleDeviceSelection(device: BleDeviceSummary) {
  console.log('[ScanView] Device selected:', device);
  try {
    await window.controller.saveSelectedDevice({
      id: device.id,
      name: device.name,
      address: device.address ?? undefined
    });
    console.log('[ScanView] Device saved, navigating to control view');
    router.push('/');
  } catch (error) {
    console.error('[ScanView] Failed to save device:', error);
  }
}
</script>
