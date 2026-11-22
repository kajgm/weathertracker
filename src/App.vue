<script setup lang="ts">
import WeatherTracker from './components/WeatherTracker.vue'
import { useAutoReload } from './composables/useAutoReload'

useAutoReload()
</script>

<template>
  <div class="flex h-screen">
    <div class="w-pi-w h-pi-h m-auto">
      <WeatherTracker />
    </div>
  </div>
</template>
