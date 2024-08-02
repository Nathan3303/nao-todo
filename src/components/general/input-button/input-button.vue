<template>
    <nue-button
        v-show="!isInput"
        :icon="icon"
        :size="size"
        @click="handleClick"
        :theme="theme || buttonTheme"
    >
        {{ buttonText }}
    </nue-button>
    <nue-div
        wrap="nowrap"
        v-show="isInput"
        align="center"
        gap="4px"
        @keydown.enter.prevent="handleKeydown"
    >
        <nue-input
            ref="inputRef"
            v-model="inputValue"
            :placeholder="buttonText"
            :size="size"
            :icon="icon"
            :theme="theme || inputTheme"
            @blur="handleBlur"
            style="flex: 1"
        ></nue-input>
        <template v-if="!submitOnBlur">
            <nue-button
                icon="check"
                @click="handleSubmit"
                :theme="theme || buttonTheme"
                :size="size"
            ></nue-button>
            <nue-button
                icon="clear"
                @click="handleCancel"
                :theme="theme || buttonTheme"
                :size="size"
            ></nue-button>
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
    icon: 'write',
    size: 'small',
    submitOnBlur: true,
    onButtonClick: () => {}
})
const emit = defineEmits<InputButtonEmits>()

const isInput = ref(false)
const inputValue = ref('')
const inputRef = ref<InstanceType<typeof NueInput>>()

const handleClick = async (event: MouseEvent) => {
    const { onButtonClick } = props
    const onButtonClickResult = await onButtonClick(event, { inputValue })
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

const handleSubmit = (cancelOnSubmitted = false) => {
    const value = inputValue.value.trim()
    if (value !== '') {
        emit('submit', { value })
        inputValue.value = ''
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
