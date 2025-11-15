<template>
  <div class="card brightness-card">
    <p class="label">Brightness</p>
    <div class="brightness-controls">
      <button
        class="control-button brightness-btn"
        type="button"
        :disabled="disabled"
        @click="$emit('decrease')"
      >−</button>
      <span class="brightness-value">{{ value }}%</span>
      <button
        class="control-button brightness-btn"
        type="button"
        :disabled="disabled"
        @click="$emit('increase')"
      >+</button>
    </div>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  value: number;
  disabled?: boolean;
}>();

defineEmits<{ (event: "increase"): void; (event: "decrease"): void }>();
</script>

<style scoped>
.brightness-card {
  margin-top: 16px;
}

.brightness-controls {
  display: flex;
  align-items: center;
  gap: 12px;
}

.brightness-btn {
  width: 36px;
  height: 36px;
  font-size: 22px;
  padding: 0;
  flex-shrink: 0;
}

.brightness-value {
  flex: 1;
  text-align: center;
  font-weight: 600;
  font-size: 16px;
  color: var(--text-primary);
}
</style>
