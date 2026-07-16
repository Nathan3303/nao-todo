<script setup lang="ts">
import { computed } from 'vue'

defineOptions({ name: 'CollapseButton' })
const props = defineProps<{ modelValue: boolean }>()
const emit = defineEmits(['update:modelValue', 'change'])

const state = computed({
    get: () => props.modelValue,
    set: (newState) => {
        emit('update:modelValue', newState)
        emit('change', newState)
    }
})

const hideAsideButtonIcon = computed(() => {
    return (state.value ? 'menu-close' : 'menu-open') as never
})

const handleClick = () => {
    state.value = !state.value
}
</script>

<template>
    <nue-button :icon="hideAsideButtonIcon" theme="icon,ghost" @click="handleClick" />
</template>
