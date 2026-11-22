<script setup lang="ts">
import WeatherTracker from './components/WeatherTracker.vue'
import { useAutoReload } from './composables/useAutoReload'

useAutoReload()
</script>

<template>
  <WeatherTracker />
</template>
