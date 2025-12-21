<script setup lang="ts">
defineOptions({ name: 'AppView' })
</script>

<template>
    <suspense>
        <router-view />
    </suspense>
</template>
