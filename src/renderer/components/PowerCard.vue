<template>
  <section class="card power-card">
    <p class="label">Power</p>
    <div class="power-buttons">
      <button
        class="control-button power-on"
        type="button"
        :class="{ active: state?.powerOn }"
        :disabled="disabled || !state"
        @click="$emit('power-on')"
      >
        ON
      </button>
      <button
        class="control-button power-off"
        type="button"
        :class="{ active: !state?.powerOn }"
        :disabled="disabled || !state"
        @click="$emit('power-off')"
      >
        OFF
      </button>
    </div>
  </section>
</template>

<script setup lang="ts">
import type { DeviceState } from "../../shared/ipc";

defineProps<{ state: DeviceState | null; disabled?: boolean }>();

defineEmits<{ 
  (event: "power-on"): void;
  (event: "power-off"): void;
}>();
</script>
