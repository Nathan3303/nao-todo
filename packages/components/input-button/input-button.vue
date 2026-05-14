<script setup lang="ts">
import { computed, nextTick, ref } from 'vue'
import { NueInput } from 'nue-ui'
import type { InputButtonProps, InputButtonEmits } from './types'

defineOptions({ name: 'InputButton' })
const props = withDefaults(defineProps<InputButtonProps>(), {
    buttonText: '点击以输入文本',
    size: 'small',
    submitOnBlur: true,
    placeholder: '请输入...',
    onButtonClick: () => {}
})
const emit = defineEmits<InputButtonEmits>()

const inputRef = ref<InstanceType<typeof NueInput>>()
const inputValue = ref('')
const isInput = ref(false)
const loading = ref(false)

const iconName = computed(() => (loading.value ? 'loading' : 'check') as never)

const handleClick = async (event: MouseEvent) => {
    await props.onButtonClick(event, { inputValue })
    isInput.value = true
    await nextTick(() => inputRef.value?.innerInputRef?.focus())
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
        return
    }
    handleSubmit(false)
}

const handleCancel = () => {
    isInput.value = false
    inputValue.value = ''
}
</script>

<template>
    <nue-div theme="event-creator">
        <nue-button theme="pure" v-if="!isInput" @click="handleClick">
            {{ buttonText }}
        </nue-button>
        <nue-div v-else theme="body" @keydown.enter.prevent="handleKeydown">
            <nue-input
                ref="inputRef"
                v-model="inputValue"
                :placeholder="placeholder"
                theme="pure"
                :disabled="loading"
                @blur="handleBlur"
                maxlength="64"
                counter="word-left"
            />
            <nue-div theme="actions">
                <nue-icon :name="iconName" :spin="loading" @click="handleSubmit" />
                <nue-icon name="clear" @click="handleCancel" />
            </nue-div>
        </nue-div>
    </nue-div>
</template>

<style scoped>
@import url('./input-button.css');
</style>

