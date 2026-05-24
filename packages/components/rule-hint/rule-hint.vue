<script setup lang="ts">
import type { RuleHintProps } from './types'

defineOptions({ name: 'RuleHint' })
defineProps<RuleHintProps>()
</script>

<template>
    <nue-div v-if="!hidden || content" theme="rule-hint" :data-variant="variant">
        <nue-icon theme="rule-hint__icon" :name="icon" />
        <nue-div theme="rule-hint__content-wrapper">
            <nue-text v-if="title" theme="title">{{ title }}</nue-text>
            <nue-text theme="content">
                <slot>{{ content }}</slot>
            </nue-text>
        </nue-div>
    </nue-div>
</template>

<style scoped>
.nue-div--rule-hint {
    display: flex;
    align-items: flex-start;
    gap: var(--nue-padding-xs);
    padding: var(--nue-padding-sm);
    border-radius: var(--nue-primary-radius);
    border: 1px solid var(--nue-border-color);
    background-color: var(--nue-primary-color-100);
    box-shadow: var(--nue-secondary-shadow);
    font-size: var(--nue-text-sm);

    > .nue-div--rule-hint__content-wrapper {
        display: flex;
        flex-direction: column;
        gap: 0;
        flex: auto;

        > .nue-text--title {
            font-weight: bold;
        }

        > .nue-text--content {
            font-size: var(--nue-text-xs);
        }
    }
}

.nue-div--rule-hint[data-variant='warning'] {
    border: 1px solid var(--nue-warning-color-30);
    background-color: var(--nue-warning-color-20);
    color: var(--nue-warning-color-80);
}

.nue-div--rule-hint[data-variant='success'] {
    border: 1px solid var(--nue-success-color-30);
    background-color: var(--nue-success-color-20);
    color: var(--nue-success-color-80);
}

.nue-div--rule-hint[data-variant='error'] {
    border: 1px solid var(--nue-error-color-30);
    background-color: var(--nue-error-color-20);
    color: var(--nue-error-color-80);
}
</style>

