<template>
    <div class="switch-button">
        <nue-button :theme="themes" :icon="iconName" v-bind="$attrs" @click="handleClick">
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

const themes = computed(() => {
    const { modelValue, theme } = props
    const activeTheme = modelValue ? 'actived' : 'inactived'
    let _return: string[] = []
    if (Array.isArray(theme)) {
        _return = theme.concat(activeTheme)
    } else {
        _return = [theme as string, activeTheme]
    }
    return _return.filter((Boolean) as any) as string[]
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
