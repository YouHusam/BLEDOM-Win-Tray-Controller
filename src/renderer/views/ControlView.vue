<template>
  <div class="shell">
    <StatusHeader :status-text="statusText" />
    
    <div v-if="!state?.selectedDevice" class="no-device">
      <p>No device connected</p>
      <button class="ghost-button" @click="goToScan">Scan for Devices</button>
    </div>
    
    <template v-else>
      <div class="card device-info-card">
        <span class="device-name">{{ state.selectedDevice.name }}</span>
        <button class="ghost-button small" @click="goToScan">Change Device</button>
      </div>
      
      <PowerCard
        :state="state"
        :disabled="!controlsAvailable || !!pendingAction"
        @power-on="handlePowerOn"
        @power-off="handlePowerOff"
      />
      
      <BrightnessCard
        :value="state?.brightness ?? 0"
        :disabled="!controlsAvailable || !!pendingAction"
        @increase="handleBrightnessUp"
        @decrease="handleBrightnessDown"
      />
      
      <PresetList
        :state="state"
        :presets="presetOptions"
        :disabled="!controlsAvailable || !!pendingAction"
        @selectColor="handlePresetSelection"
        @deletePreset="handleDeletePreset"
      />
      
      <CustomColorCard
        v-model:color="customColorHex"
        v-model:presetName="customPresetName"
        :disabled="!controlsAvailable || !!pendingAction"
        @apply-color="handleCustomColor"
        @save="handleSaveCustomColor"
      />
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import { useRouter } from "vue-router";
import type {
  DeviceState,
  CustomPreset
} from "../../shared/ipc";
import PowerCard from "../components/PowerCard.vue";
import PresetList, { type PresetOption } from "../components/PresetList.vue";
import StatusHeader from "../components/StatusHeader.vue";
import BrightnessCard from "../components/BrightnessCard.vue";
import CustomColorCard from "../components/CustomColorCard.vue";

const router = useRouter();
const state = ref<DeviceState | null>(null);
const pendingAction = ref<Promise<DeviceState> | null>(null);
const customColorHex = ref("#ffffff");
const customPresetName = ref("");
const customPresets = ref<PresetOption[]>([]);
let unsubscribe: (() => void) | null = null;

function fromStoredPreset(preset: CustomPreset): PresetOption {
  return {
    id: preset.id,
    label: preset.label,
    color: preset.color
  };
}

function serializePreset(preset: PresetOption): CustomPreset {
  return {
    id: preset.id,
    label: preset.label,
    color: preset.color
  };
}

const builtInPresets: PresetOption[] = [
  { id: "bright", label: "Bright", color: "#ff800f" },
  { id: "brighter", label: "Brighter", color: "#FDD835" },
  { id: "dark", label: "Dark", color: "#230c00" },
  { id: "darkred", label: "D. Red", color: "#210300" },
  { id: "vdarkred", label: "v.D. Red", color: "#0a0000" },
  { id: "white", label: "White", color: "#ffffff" }
];

const presetOptions = computed(() => [...builtInPresets, ...customPresets.value]);

const controlsAvailable = computed(() => Boolean(state.value?.connected));
const statusText = computed(() => formatStatus(state.value));

function formatStatus(current: DeviceState | null): string {
  if (!current) {
    return "Connecting…";
  }
  if (!current.selectedDevice) {
    return "No Device";
  }
  if (!current.connected) {
    return "Disconnected";
  }
  return current.powerOn ? "LED Strip On" : "LED Strip Off";
}

function goToScan() {
  router.push('/scan');
}

async function refreshState(): Promise<void> {
  try {
    const next = await window.controller.getState();
    state.value = next;
    if (!next.selectedDevice) {
      router.push('/scan');
    }
  } catch (error) {
    console.error("[Renderer] Failed to fetch initial state", error);
  }
}

async function loadCustomPresets(): Promise<void> {
  try {
    console.log('[Renderer] Loading custom presets...');
    const saved = await window.controller.getCustomPresets();
    console.log('[Renderer] Loaded custom presets:', saved);
    customPresets.value = saved.map((preset) => fromStoredPreset(preset));
  } catch (error) {
    console.error("[Renderer] Failed to load custom presets", error);
  }
}

async function persistCustomPresets(): Promise<void> {
  try {
    const serialized = customPresets.value.map((preset) => serializePreset(preset));
    console.log('[Renderer] Saving custom presets:', serialized);
    const result = await window.controller.saveCustomPresets(serialized);
    console.log('[Renderer] Custom presets saved, result:', result);
  } catch (error) {
    console.error("[Renderer] Failed to save custom presets", error);
  }
}

async function handlePowerOn(): Promise<void> {
  if (!state.value || !controlsAvailable.value || pendingAction.value) {
    return;
  }
  try {
    pendingAction.value = window.controller.setPower(true);
    state.value = await pendingAction.value;
  } catch (error) {
    console.error("[Renderer] Failed to turn on", error);
  } finally {
    pendingAction.value = null;
  }
}

async function handlePowerOff(): Promise<void> {
  if (!state.value || !controlsAvailable.value || pendingAction.value) {
    return;
  }
  try {
    pendingAction.value = window.controller.setPower(false);
    state.value = await pendingAction.value;
  } catch (error) {
    console.error("[Renderer] Failed to turn off", error);
  } finally {
    pendingAction.value = null;
  }
}

async function handlePresetSelection(hexColor: string): Promise<void> {
  if (!state.value || !controlsAvailable.value || pendingAction.value) {
    return;
  }
  try {
    pendingAction.value = window.controller.setColor(hexColor);
    state.value = await pendingAction.value;
  } catch (error) {
    console.error("[Renderer] Failed to set color", error);
  } finally {
    pendingAction.value = null;
  }
}

async function handleBrightnessUp(): Promise<void> {
  if (!state.value || !controlsAvailable.value || pendingAction.value) {
    return;
  }
  try {
    pendingAction.value = window.controller.increaseBrightness();
    state.value = await pendingAction.value;
  } catch (error) {
    console.error("[Renderer] Failed to increase brightness", error);
  } finally {
    pendingAction.value = null;
  }
}

async function handleBrightnessDown(): Promise<void> {
  if (!state.value || !controlsAvailable.value || pendingAction.value) {
    return;
  }
  try {
    pendingAction.value = window.controller.decreaseBrightness();
    state.value = await pendingAction.value;
  } catch (error) {
    console.error("[Renderer] Failed to decrease brightness", error);
  } finally {
    pendingAction.value = null;
  }
}

async function handleCustomColor(): Promise<void> {
  await handlePresetSelection(customColorHex.value);
}

async function handleSaveCustomColor(): Promise<void> {
  const label = customPresetName.value.trim();
  if (label) {
    const newPreset = {
      id: `custom-${Date.now()}`,
      label,
      color: customColorHex.value
    };
    customPresets.value = [...customPresets.value, newPreset];
    await persistCustomPresets();
    customPresetName.value = '';
    await handlePresetSelection(customColorHex.value);
  }
}

async function handleDeletePreset(presetId: string): Promise<void> {
  const next = customPresets.value.filter((preset) => preset.id !== presetId);
  if (next.length !== customPresets.value.length) {
    customPresets.value = next;
    await persistCustomPresets();
  }
}

onMounted(() => {
  refreshState().catch(() => undefined);
  loadCustomPresets().catch(() => undefined);
  unsubscribe = window.controller.onState((next) => {
    state.value = next;
  });
});

onBeforeUnmount(() => {
  unsubscribe?.();
});
</script>
