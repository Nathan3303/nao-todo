<script setup lang="ts">
import SettingsAside from './aside.vue'
// import SettingsFloatAside from './float-aside.vue'

defineOptions({ name: 'SettingsAsideWrapper' })
</script>

<template>
    <!-- <settings-float-aside v-if="isUseFloatAside" /> -->
    <!-- <template v-else-if="isDisplayAside"> -->
    <settings-aside max-width="256px" min-width="180px" />
    <nue-separator op-target="previous" />
    <!-- </template> -->
</template>

