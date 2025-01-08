<template>
    <text v-if="name" :class="classes" />
</template>

<script lang="ts" setup>
import { computed } from 'vue'

defineOptions({ name: 'NuemIcon' })
const props = defineProps<{ name?: string; spin?: boolean }>()

const classes = computed(() => {
    const prefix = 'nuem-icon'
    return [prefix, 'iconfont', `icon-${props.name}`, props.spin && `${prefix}--spin`]
})
</script>

<style scoped>
.nuem-icon {
    --icon-size: inherit;
    --icon-color: inherit;
}

.nuem-icon {
    font-size: var(--icon-size);
    color: var(--icon-color);
}

.nuem-icon::before {
    font-size: var(--icon-size) !important;
    color: var(--icon-color) !important;
}

.nuem-icon.nuem-icon--spin {
    display: inline-block;
    animation: spin 2s infinite linear;
}
</style>
