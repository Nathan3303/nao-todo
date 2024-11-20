<template>
    <div class="switch-button">
        <nue-button
            :theme="themes"
            :icon="modelValue ? activeIcon : icon"
            v-bind="$attrs"
            @click="handleClick"
        >
            {{ modelValue ? activeText : text }}
        </nue-button>
    </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { IconNameType } from 'nue-ui'

defineOptions({ name: 'SwitchButton' })
const props = defineProps<{
    modelValue: boolean
    icon?: IconNameType | string
    activeIcon?: IconNameType | string
    text?: string
    activeText?: string
    theme?: string | string[]
}>()
const emit = defineEmits<{
    (event: 'update:modelValue', value: boolean): void
    (event: 'change', value: boolean): void
}>()

const themes = computed(() => {
    const { modelValue, theme } = props
    const activeTheme = modelValue ? 'actived' : 'inactived'
    let _return: string[]
    if (Array.isArray(theme)) {
        _return = theme.concat(activeTheme)
    } else {
        _return = [theme as string, activeTheme]
    }
    return _return.filter(Boolean as any) as string[]
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
    box-shadow: 0px 0 2px #ee537f;
}
</style>
