<template>
    <div class="switch-button">
        <nue-button :theme="theme" :icon="iconName" v-bind="$attrs" @click="handleClick">
            {{ modelValue ? activeText : text }}
        </nue-button>
    </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import type { SwitchButtonProps, SwitchButtonEmits } from './types'

defineOptions({ name: 'SwitchButton' })
const props = defineProps<SwitchButtonProps>()
const emit = defineEmits<SwitchButtonEmits>()

const iconName = computed(() => {
    const { modelValue, icon, activeIcon } = props
    return modelValue ? activeIcon : icon
})

const theme = computed(() => {
    const { modelValue } = props
    return modelValue ? 'actived' : 'inactived'
})

const handleClick = () => {
    const newValue = !props.modelValue
    emit('update:modelValue', newValue)
    emit('change', newValue)
}
</script>

<style scoped>
.nue-button--inactived {
    color: #555;
}

.nue-button--actived {
    color: #fff;
    background-color: #ee537f;
    border-color: #ee537f;
    box-shadow: 0px 0px 2px #ee537f;
}
</style>
