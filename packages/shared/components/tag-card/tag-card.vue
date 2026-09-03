<script setup lang="ts">
import { t } from '@nao-todo/shared'
import type { TagCardProps } from './types'
import TagColorDot from '../tag-color-dot/tag-color-dot.vue'

defineOptions({ name: 'TagCard', inheritAttrs: false })
defineProps<TagCardProps>()
</script>

<template>
    <nue-div theme="card,tag-card">
        <nue-div theme="name-wrapper">
            <tag-color-dot
                :color="tag.color"
                :title="
                    t('component.tagCard.colorTip', {
                        color:
                            tag.color === 'transparent'
                                ? t('component.tagCard.colorTransparent')
                                : tag.color
                    })
                "
            />
            <nue-text theme="name" :clamped="1">{{ tag.name }}</nue-text>
            <nue-div theme="ops"> <slot name="ops" /> </nue-div>
        </nue-div>
        <nue-text theme="description" :clamped="2">
            {{ tag.description || t('component.tagCard.noDescription') }}
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
            align-items: center;
            margin-left: auto;
            gap: var(--nue-gap-sm);
        }
    }

    .nue-text--description {
        font-size: var(--nue-text-xs);
        color: var(--nue-primary-color-600);
    }
}
</style>