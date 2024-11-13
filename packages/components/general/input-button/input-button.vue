<template>
    <nue-button
        v-show="!isInput"
        :icon="icon"
        :size="size"
        @click="handleClick"
        :theme="theme || buttonTheme"
        style="gap: 8px"
    >
        {{ buttonText }}
    </nue-button>
    <nue-div
        wrap="nowrap"
        v-show="isInput"
        align="center"
        gap="6px"
        style="padding-left: 2px"
        @keydown.enter.prevent="handleKeydown"
    >
        <nue-icon size="14px" :name="loading ? 'loading' : icon" :spin="loading" />
        <nue-input
            ref="inputRef"
            v-model="inputValue"
            :placeholder="buttonText"
            :size="size"
            :theme="theme || inputTheme"
            :disabled="loading"
            style="flex: 1"
            @blur="handleBlur"
        />
        <template v-if="!submitOnBlur">
            <nue-button
                icon="check"
                :theme="theme || buttonTheme"
                :size="size"
                :disabled="loading"
                @click="handleSubmit"
            />
            <nue-button
                icon="clear"
                :theme="theme || buttonTheme"
                :size="size"
                :disabled="loading"
                @click="handleCancel"
            />
        </template>
    </nue-div>
</template>

<script setup lang="ts">
import { nextTick, ref } from 'vue'
import type { InputButtonProps, InputButtonEmits } from './types'
import { NueInput } from 'nue-ui'

defineOptions({ name: 'InputButton' })
const props = withDefaults(defineProps<InputButtonProps>(), {
    buttonText: 'Click to input text',
    size: 'small',
    submitOnBlur: true,
    onButtonClick: () => {}
})
const emit = defineEmits<InputButtonEmits>()

const isInput = ref(false)
const inputValue = ref('')
const inputRef = ref<InstanceType<typeof NueInput>>()
const loading = ref(false)

const handleClick = async (event: MouseEvent) => {
    const { onButtonClick } = props
    await onButtonClick(event, { inputValue })
    isInput.value = true
    nextTick(() => {
        inputRef.value?.innerInputRef?.focus()
    })
}

const handleBlur = () => {
    const { submitOnBlur } = props
    if (submitOnBlur) {
        handleSubmit()
    }
}

const handleSubmit = async (cancelOnSubmitted = false) => {
    const value = inputValue.value.trim()
    if (value !== '') {
        const { onSubmit } = props
        if (onSubmit) {
            loading.value = true
            await onSubmit({ value })
            loading.value = false
        } else {
            emit('submit', { value })
        }
        inputValue.value = ''
        nextTick(() => inputRef.value?.innerInputRef?.focus())
    }
    if (cancelOnSubmitted) {
        handleCancel()
    }
}

const handleKeydown = () => {
    const { submitOnBlur } = props
    if (submitOnBlur) {
        handleSubmit(true)
    } else {
        handleSubmit(false)
    }
}

const handleCancel = () => {
    isInput.value = false
}
</script>

<style scoped>
@import url('./input-button.css');
</style>
