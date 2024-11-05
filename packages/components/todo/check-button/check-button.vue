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
const props = defineProps<{ isDone: boolean }>()
const emit = defineEmits<{ (event: 'change', isDone: boolean): void }>()

const isHover = ref(false)

const iconName = computed(() => {
    const { isDone } = props
    if (isHover.value && !isDone) {
        return 'square-check'
    }
    return isDone ? 'square-check-fill' : 'square'
})

const handleClick = () => {
    const { isDone } = props
    emit('change', !isDone)
}
</script>

<style scoped>
.todo-check-button {
    --icon-size: 16px;
    --icon-weight: normal;
    cursor: pointer;
    transition: all 0.16s;
}
</style>
