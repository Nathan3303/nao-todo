<template>
    <button :class="classes" :disabled="disabled" :name="name" @click="handleClick">
        <nuem-icon v-if="iconName" :name="iconName" :spin="loading" class="nuem-button__icon" />
        <slot />
        <view v-if="$slots.append" class="nuem-button__append">
            <slot name="append" />
        </view>
    </button>
</template>

<script lang="ts" setup>
import { computed } from 'vue'
import NuemIcon from './icon.vue'
import { parseTheme } from './utils'

defineOptions({ name: 'NuemButton' })
const props = defineProps<{
    name?: string
    icon?: string
    theme?: string
    disabled?: boolean
    loading?: boolean
}>()
const emit = defineEmits<{
    (e: 'click', payload: Event): void
}>()

const classes = computed(() => {
    const prefix = 'nuem-button'
    const isDisabled = props.disabled || props.loading
    return [prefix, ...parseTheme(props.theme, prefix), isDisabled && 'nuem-button--disabled']
})

const iconName = computed(() => {
    const { loading, icon } = props
    return loading ? `loading` : icon || void 0
})

const handleClick = (e: Event) => {
    if (!props.disabled) emit('click', e)
}
</script>

<style scoped>
.nuem-button {
    --vgap: 0.6rem;
    --fs: var(--text-sm);
    --flex: 0 1 auto;
    --alignment: start;
    --color: var(--primary-text-color);
    --border-color: var(--divider-color);
    --background-color: transparent;
    --hover-color: var(--color);
    --hover-border-color: var(--border-color);
    --hover-background-color: var(--primary-color-100);
    --active-color: var(--color);
    --active-border-color: var(--border-color);
    --active-background-color: var(--primary-color-200);
    --disable-color: var(--disabled-color);
    --disable-border-color: var(--border-color);
    --disable-background-color: var(--primary-color-200);
}

.nuem-button {
    background: transparent;
    padding: var(--vgap) calc(var(--vgap) * 1.2);
    margin: 0;
    line-height: 1.2;
    display: flex;
    flex-wrap: nowrap;
    align-items: center;
    gap: var(--vgap);
    border: 1px solid var(--border-color);
    border-radius: var(--primary-radius);
    font-size: var(--fs);
    box-shadow: var(--secondary-shadow);
    box-sizing: border-box;
}

.nuem-button::after {
    border: 0;
}

.nuem-button:hover {
    color: var(--hover-color);
    background-color: var(--hover-background-color);
    border-color: var(--hover-border-color);
}

.nuem-button:active {
    color: var(--active-color);
    background-color: var(--active-background-color);
    border-color: var(--active-border-color);
}

.nuem-button__append {
    display: flex;
    flex-wrap: nowrap;
    gap: var(--vgap);
    flex: none;
    margin-left: auto;
}

.nuem-button--disabled {
    opacity: 0.5;
    pointer-events: none;
    cursor: not-allowed;
    touch-action: none;
    background-color: var(--primary-color-300);
}

.nuem-button.nuem-button--rl {
    --rl-fs: calc(var(--fs) - 0.125rem);
    --icon-size: 0.9375rem;
    font-size: var(--rl-fs);
    border-color: transparent;
    background-color: transparent;
    box-shadow: none;
}

.nuem-button.nuem-button--pri {
    border-color: var(--primary-color-900);
    background-color: var(--primary-color-900);
    color: white;
}

.nuem-button.nuem-button--ico {
    border-color: transparent;
    background-color: transparent;
    box-shadow: none;
}

.nuem-button.nuem-button--sm {
    --vgap: 0.375rem;
    --fs: var(--text-xs);
    padding: var(--vgap) calc(var(--vgap) * 1.5);
}

.nuem-button.nuem-button--lg {
    --vgap: 0.8rem;
    --fs: var(--text-default);
}
</style>
