<script setup lang="ts">
import type { TagCardProps } from './types'

defineOptions({ name: 'TagCard', inheritAttrs: false })
defineProps<TagCardProps>()
</script>

<template>
    <nue-div theme="card,tag-card">
        <nue-div theme="name-wrapper">
            <nue-icon theme="icon" name="tag" />
            <nue-text theme="name" :clamped="1">{{ tag.name }}</nue-text>
            <nue-div theme="ops">
                <slot name="ops" />
            </nue-div>
        </nue-div>
        <nue-text theme="description" :clamped="2">
            {{ tag.description || '标签无描述' }}
        </nue-text>
    </nue-div>
</template>

<style scoped>
.nue-div--tag-card {
    flex-direction: column;
    gap: var(--nue-gap-2xs);

    .nue-div--name-wrapper {
        align-items: center;
        gap: var(--nue-gap-xs);

        .nue-icon--icon {
            font-size: var(--nue-text-df);
        }

        .nue-text--name {
            font-size: var(--nue-text-df2);
        }

        .nue-div--ops {
            margin-left: auto;
        }
    }

    .nue-text--description {
        font-size: var(--nue-text-xs);
        color: var(--nue-primary-color-600);
    }
}
</style>