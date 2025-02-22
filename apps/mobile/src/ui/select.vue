<script lang="ts" setup>
import { ref } from 'vue'
import NuemButton from './button.vue'
import NuemIcon from '@/ui/icon.vue'

defineOptions({ name: 'NuemSelect' })
const props = defineProps<{
    options: { label: string; value: unknown }[]
    modelValue: unknown
}>()
const emit = defineEmits<{
    (e: 'update:modelValue', payload: unknown): void
}>()

const visible = ref(false)

const getModelValueLabel = () => {
    return props.options.find((option) => option.value === props.modelValue)?.label
}

const handleSelect = (optionValue: unknown) => {
    visible.value = false
    emit('update:modelValue', optionValue)
}
</script>

<template>
    <view class="nuem-select">
        <nuem-button class="nuem-select__trigger" @click="visible = !visible">
            {{ getModelValueLabel() ?? '优先级' }}
            <template #append>
                <nuem-icon name="select" />
            </template>
        </nuem-button>
        <view v-if="visible" class="nuem-select__list">
            <nuem-button
                v-for="option in options"
                :key="option.value + ''"
                :data-selected="modelValue === option.value"
                class="nuem-select__list__item"
                theme="rl"
                @click="handleSelect(option.value)"
            >
                {{ option.label }}
                <!--                <template v-if="modelValue === option.value" #append>-->
                <!--                    <nuem-icon name="check" />-->
                <!--                </template>-->
            </nuem-button>
        </view>
    </view>
</template>

<style scoped>
.nuem-select {
    display: flex;
    align-items: center;
    justify-content: center;
    position: relative;
    gap: 0.5rem;
    flex: none;
    width: fit-content;
}

.nuem-select__list {
    position: absolute;
    left: 0;
    top: 100%;
    margin-top: 0.5rem;
    border-radius: var(--primary-radius);
    border: 1px solid var(--divider-color);
    box-shadow: var(--secondary-shadow);
    padding: 4px;
    display: flex;
    flex-direction: column;
    gap: 4px;
    background-color: white;
    z-index: 99;
    width: 6rem;
    box-sizing: border-box;
}
</style>
