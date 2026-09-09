<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { NueInput } from 'nue-ui'

defineOptions({ name: 'TaskNameFilter' })
const props = defineProps<{ placeholder?: string; modelValue: string }>()
const emit = defineEmits<{ (e: 'update:modelValue', value: string): void }>()

const inputValue = computed({
    get: () => props.modelValue,
    set: (value) => emit('update:modelValue', value)
})

// @input 名称筛选框非身份字段：autocomplete="off" 阻止浏览器凭据/联系人自动填充误写入
// （nue-input 1.11.0 不透传 autocomplete 至内层 input，经暴露的 innerInputRef 设于真实输入元素）
const nameFilterInput = ref<InstanceType<typeof NueInput>>()
onMounted(() => {
    nameFilterInput.value?.innerInputRef?.setAttribute('autocomplete', 'off')
})
</script>

<template>
    <nue-input
        ref="nameFilterInput"
        theme="pure,small"
        :placeholder="placeholder || '根据名称筛选'"
        v-model="inputValue"
        clearable
        icon="search"
        :debounce-time="360"
        style="width: 100%"
    />
</template>

<style scoped>
.nue-input {
    border: none;
    border-radius: 0;
    font-size: var(--nue-text-sm);
    padding: 0 var(--nue-padding-xs);
    height: var(--nue-box-size-xs);
    gap: var(--nue-gap-xs);
    color: var(--nue-primary-color-900);
    opacity: 0.8;
}
</style>