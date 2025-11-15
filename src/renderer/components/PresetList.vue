<template>
  <section class="card presets-card">
    <p class="label">Color Presets</p>
    <div class="presets">
      <div
        v-for="preset in normalizedPresets"
        :key="preset.id"
        class="preset-wrapper"
      >
        <button
          class="preset"
          :class="{ active: isActive(preset) }"
          type="button"
          :aria-label="preset.label"
          :disabled="disabled"
          :style="{ background: preset.swatch }"
          @click="$emit('selectColor', preset.color)"
        >
          {{ preset.label }}
        </button>
        <button
          v-if="preset.id.startsWith('custom-')"
          class="delete-preset"
          type="button"
          :disabled="disabled"
          @click="$emit('deletePreset', preset.id)"
          title="Delete preset"
        >
          ×
        </button>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed } from "vue";
import type { DeviceState } from "../../shared/ipc";

export type PresetOption = {
  id: string;
  label: string;
  color: string; // hex color
};

const props = defineProps<{
  state: DeviceState | null;
  presets: PresetOption[];
  disabled?: boolean;
}>();

defineEmits<{ 
  (event: "selectColor", payload: string): void;
  (event: "deletePreset", presetId: string): void;
}>();

const normalizedPresets = computed(() =>
  props.presets.map((preset) => ({
    ...preset,
    swatch: preset.color
  }))
);

const isActive = (preset: PresetOption): boolean => {
  if (!props.state?.powerOn) {
    return false;
  }
  return props.state.color.toLowerCase() === preset.color.toLowerCase();
};
</script>

<style scoped>
.preset-wrapper {
  position: relative;
  display: inline-block;
}

.preset {
  color: rgba(255, 255, 255, 0.95);
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.5);
  font-weight: 600;
  width: 100%;
}

.preset.active {
  box-shadow: 0 0 0 3px rgba(255, 255, 255, 0.5);
}

.delete-preset {
  position: absolute;
  top: -6px;
  right: -6px;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: #f44336;
  color: white;
  border: 2px solid #1e1e1e;
  font-size: 16px;
  line-height: 1;
  padding: 0;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0;
  transition: opacity 0.2s ease;
}

.preset-wrapper:hover .delete-preset {
  opacity: 1;
}

.delete-preset:hover {
  background: #d32f2f;
}
</style>
