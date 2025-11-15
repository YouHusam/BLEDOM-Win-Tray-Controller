<template>
  <div class="card custom-color-card">
    <p class="label">Custom Color</p>
    <div class="custom-color-controls">
      <input
        type="color"
        class="color-picker"
        :value="color"
        :disabled="disabled"
        @change="onColorChange"
      />
      <input
        type="text"
        class="preset-name-input"
        :value="presetName"
        :disabled="disabled"
        placeholder="Preset name"
        @input="onPresetNameInput"
      />
      <button
        class="ghost-button small"
        type="button"
        :disabled="isSaveDisabled"
        @click="$emit('save')"
      >Save</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";

const props = defineProps<{
  color: string;
  presetName: string;
  disabled?: boolean;
}>();

const emit = defineEmits<{
  (event: "update:color", value: string): void;
  (event: "update:presetName", value: string): void;
  (event: "apply-color"): void;
  (event: "save"): void;
}>();

const isSaveDisabled = computed(() => props.disabled || !props.presetName.trim());

function onColorChange(event: Event): void {
  const value = (event.target as HTMLInputElement).value;
  emit("update:color", value);
  emit("apply-color");
}

function onPresetNameInput(event: Event): void {
  emit("update:presetName", (event.target as HTMLInputElement).value);
}
</script>

<style scoped>
.custom-color-controls {
  display: flex;
  align-items: center;
  gap: 10px;
}

.color-picker {
  width: 54px;
  height: 42px;
  border: 1px solid var(--surface-border);
  border-radius: 8px;
  background: transparent;
  cursor: pointer;
  transition: border-color 200ms ease;
  flex-shrink: 0;
}

.color-picker:hover {
  border-color: rgba(255, 255, 255, 0.2);
}

.color-picker::-webkit-color-swatch-wrapper {
  padding: 4px;
}

.color-picker::-webkit-color-swatch {
  border: none;
  border-radius: 4px;
}

.preset-name-input {
  flex: 1;
  min-width: 0;
  height: 42px;
  padding: 0 12px;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid var(--surface-border);
  border-radius: 8px;
  color: var(--text-primary);
  font-size: 14px;
  font-family: inherit;
  transition: border-color 200ms ease, background 200ms ease;
}

.preset-name-input::placeholder {
  color: var(--text-muted);
}

.color-picker:disabled,
.preset-name-input:disabled {
  opacity: 0.35;
  cursor: not-allowed;
}
</style>
