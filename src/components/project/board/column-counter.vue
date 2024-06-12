<template>
    <nue-text :class="classes">{{ value }}</nue-text>
</template>

<script setup lang="ts">
import { computed } from 'vue'

defineOptions({
    name: 'ColumnCounter'
})

const props = withDefaults(
    defineProps<{
        value: number
    }>(),
    {
        value: 0
    }
)

const classes = computed(() => {
    let list = ['column-counter']
    if (props.value > 0) list.push('column-counter--positive')
    return list
})
</script>

<style scoped>
.column-counter {
    background-color: #f1f3f5;
    color: var(--secondary-color) !important;
    font-size: 14px !important;
    font-weight: bold !important;
    padding: 4px 8px;
    border-radius: 6px;
    margin-left: 8px;
}

.column-counter--positive {
    background-color: #ebf3ff;
    color: var(--third-color) !important;
}
</style>
