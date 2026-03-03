<script setup lang="ts">
import { computed, nextTick, ref } from 'vue'
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

const iconName = computed(() => (loading.value ? 'loading' : props.icon) as never)

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

<template>
    <nue-button
        v-show="!isInput"
        :icon="icon"
        :size="size"
        @click="handleClick"
        class="nue-button--icon-fix"
        :theme="theme || buttonTheme"
        style="gap: 0.5rem"
    >
        {{ buttonText }}
    </nue-button>
    <nue-div
        wrap="nowrap"
        v-show="isInput"
        align="center"
        gap="0.5rem"
        @keydown.enter.prevent="handleKeydown"
    >
        <nue-icon size="1rem" :name="iconName" :spin="loading" />
        <nue-input
            ref="inputRef"
            v-model="inputValue"
            :placeholder="buttonText"
            :size="size"
            theme="pure"
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
                @click="() => handleSubmit()"
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

<style scoped>
.nue-button {
    font-size: var(--nue-text-sm);
}

.nue-button--pure {
    --nue-button-disable-background-color: transparent;
    height: var(--nue-box-size-sm);
    border: none;
}

.nue-button--icon-fix:deep(.nue-button__icon) {
    font-size: 1rem;
}

.nue-input--small {
    border: none;

    &:deep(.nue-input__input) {
        font-size: var(--nue-text-sm);
    }
}
</style>
