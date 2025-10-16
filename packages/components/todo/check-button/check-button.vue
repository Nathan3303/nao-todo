<template>
    <nue-button
        class="todo-check-button"
        theme="pure"
        :icon="iconName"
        @click="handleClick"
        @mouseover="isHover = true"
        @mouseout="isHover = false"
    />
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'

defineOptions({ name: 'TodoCheckButton' })
const props = defineProps<{
    isDone: boolean
}>()
const emit = defineEmits<{
    (event: 'change', isDone: boolean): void
}>()

const isHover = ref(false)

const iconName = computed(() => {
    const { isDone } = props
    if (isHover.value && !isDone) return 'square-check'
    return isDone ? 'square-check-fill' : 'square'
})

const handleClick = () => {
    emit('change', !props.isDone)
}
</script>

<style scoped>
.nue-button.todo-check-button {
    --nue-button-font-size: 1.125rem;
    cursor: pointer;
    transition: all 0.16s;
}
</style>
