<script setup lang="ts">
defineOptions({ name: 'TasksDropdownDivBlock' })
defineProps<{ title: string }>()
</script>

<template>
    <nue-div theme="block">
        <nue-text theme="title">{{ title }}</nue-text>
        <slot></slot>
    </nue-div>
</template>

<style scoped></style>
