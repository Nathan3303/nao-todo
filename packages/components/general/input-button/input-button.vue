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
import { NueInput } from 'nue-ui'
import type { InputButtonProps, InputButtonEmits } from './types'

defineOptions({ name: 'InputButton' })
const props = withDefaults(defineProps<InputButtonProps>(), {
    buttonText: '点击以输入文本',
    size: 'small',
    submitOnBlur: true,
    onButtonClick: () => {}
})
const emit = defineEmits<InputButtonEmits>()

const inputRef = ref<InstanceType<typeof NueInput>>()
const inputValue = ref('')
const isInput = ref(false)
const loading = ref(false)

const handleClick = async (event: MouseEvent) => {
    await props.onButtonClick(event, { inputValue })
    isInput.value = true
    await nextTick(() => {
        inputRef.value?.innerInputRef?.focus()
    })
}

const handleBlur = () => {
    if (props.submitOnBlur) handleSubmit()
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
        await nextTick(() => inputRef.value?.innerInputRef?.focus())
    }
    if (cancelOnSubmitted) handleCancel()
}

const handleKeydown = () => {
    if (props.submitOnBlur) {
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
.nue-button--pure {
    --disable-background-color: transparent;
    height: 28px;
    padding: 0 2px;
}

.nue-input--small {
    --disabled-background-color: transparent;
    padding: 0 2px;
    height: 28px;
    font-size: var(--text-xs);
    border-width: 0;
}
</style>
