<template>
  <header class="header">
    <div>
      <p class="subtitle">BLELKDOM</p>
      <h1 class="title">LED Controller</h1>
    </div>
    <span class="status">{{ statusText }}</span>
  </header>
</template>

<script setup lang="ts">
defineProps<{ statusText: string }>();
</script>
