<template>
    <nue-button
        theme="pure,icon,chkbtn"
        :size="size"
        :icon="iconName"
        @click="emit('change', !props.isDone)"
        @mouseover="isHover = true"
        @mouseout="isHover = false"
    />
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'

type TodoCheckButtonProps = {
    isDone: boolean
    checked?: boolean
    size?: 'small' | 'large'
}
type TodoCheckButtonEmits = {
    (event: 'change', isDone: boolean): void
}

defineOptions({ name: 'TodoCheckButton', inheritAttrs: false })
const props = defineProps<TodoCheckButtonProps>()
const emit = defineEmits<TodoCheckButtonEmits>()

const isHover = ref(false)

const iconName = computed(() => {
    return isHover.value ? 'square-check' : props.isDone ? 'square-check-fill' : 'square'
})
</script>

<style scoped>
.nue-button.nue-button--chkbtn {
    --nue-button-font-size: 1.25rem;
    --nue-button-color: var(--nue-primary-color-800);
    cursor: pointer;

    &.nue-button--small {
        --nue-button-font-size: 1rem;
    }

    &.nue-button--large {
        --nue-button-font-size: 1.375rem;
    }
}
</style>

