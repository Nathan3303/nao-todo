<script setup lang="ts">
type UpdateIndicatorProps = {
    updating: boolean
    count: number
}

defineOptions({ name: 'UpdateIndicator' })
defineProps<UpdateIndicatorProps>()
</script>

<template>
    <nue-icon name="update" :spin="updating" />
</template>

<style scoped>
.nue-icon {
    --nue-icon-size: var(--nue-text-md);
    --nue-icon-color: var(--nue-primary-color-700);
}
</style>

