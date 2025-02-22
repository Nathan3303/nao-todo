<template>
    <view :class="classes">
        <nuem-icon v-if="icon" :name="icon" class="nuem-input__icon" />
        <input
            ref="inputRef"
            v-model="inputValue"
            :placeholder="placeholder"
            class="nuem-input__icon"
            :disabled="disabled"
            @change="handelChange"
            @input="handleInput"
        />
    </view>
</template>

<script lang="ts" setup>
import { ref, computed } from 'vue'
import NuemIcon from './icon.vue'

defineOptions({ name: 'NuemInput' })
const props = defineProps<{
    icon?: string
    modelValue?: string
    placeholder?: string
    disabled?: boolean
}>()
const emit = defineEmits<{
    (e: 'update:modelValue', value: string): void
    (e: 'change', event: Event, value: string): void
}>()

const inputRef = ref()
const inputValue = ref(props.modelValue || '')

const classes = computed(() => {
    const prefix = 'nuem-input'
    return [prefix, props.disabled ? `${prefix}--disabled` : void 0]
})

const handleInput = (e: Event) => {
    const target = e.target as HTMLInputElement
    emit('update:modelValue', target.value)
}

const handelChange = (e: Event) => {
    const target = e.target as HTMLInputElement
    emit('update:modelValue', target.value)
    emit('change', e, target.value)
}
</script>

<style scoped>
.nuem-input {
    --width: auto;
    --height: auto;
    --padding-x: 12px;
    --border-color: var(--divider-color);
    --background-color: transparent;
    --flex: none;
    --hover-border-color: var(--primary-color-600);
    --hover-background-color: transparent;
    --focus-border-color: var(--primary-color-600);
    --focus-background-color: transparent;
    --focus-shadow: var(--primary-shadow);
    --disabled-color: #9e9e9e;
    --disabled-border-color: var(--divider-color);
    --disabled-background-color: var(--primary-color-100);
    --button-size: var(--font-size);
    --button-color: var(--border-color);
    --button-border-color: var(--border-color);
    --button-hover-color: var(--hover-border-color);
}

.nuem-input {
    display: flex;
    align-items: center;
    gap: var(--secondary-gap);
    width: var(--width);
    min-width: var(--min-width);
    height: var(--height);
    min-height: 36px;
    padding: 0 var(--padding-x);
    border: 1px solid var(--border-color);
    border-radius: var(--primary-radius);
    background-color: var(--background-color);
    box-shadow: var(--secondary-shadow);
    flex: var(--flex);
    box-sizing: border-box;
    overflow: hidden;
    position: relative;
    transition: all 0.16s ease;
    -webkit-user-select: none;
    user-select: none;
    color: var(--primary-text-color);
    font-size: var(--text-sm);
    font-weight: var(--primary-font-weight);
}

.nuem-input:hover {
    border-color: var(--hover-border-color);
    background-color: var(--hover-background-color);
}

.nuem-input:focus-within {
    border-color: var(--focus-border-color);
    background-color: var(--focus-background-color);
    box-shadow: var(--focus-shadow);
}

.nuem-input input {
    flex: auto;
    border: none;
}

.nuem-input.nuem-input--disabled {
    --hover-border-color: var(--disabled-border-color);
    --hover-background-color: var(--disabled-background-color);
    color: var(--disabled-color) !important;
    border-color: var(--disabled-border-color);
    background-color: var(--disabled-background-color);
    cursor: not-allowed;
    -webkit-user-select: none;
    user-select: none;
}
</style>
