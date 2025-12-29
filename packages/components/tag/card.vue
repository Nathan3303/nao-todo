<script setup lang="ts">
import type { TagVO } from '@nao-todo/types'

type TagCardProps = {
    tag: TagVO
}

defineOptions({ name: 'TagCard', inheritAttrs: false })
defineProps<TagCardProps>()
</script>

<template>
    <nue-div theme="card" align="center" justify="space-between" auto-fit>
        <nue-text :clamped="1">
            {{ tag.name }}
        </nue-text>
        <nue-div align="center">
            <slot name="ops" />
        </nue-div>
    </nue-div>
</template>

<!-- <style scoped>
.nue-div.nue-div--tag-card {
    flex-direction: column;
    padding: 1rem;
    border-radius: var(--nue-primary-radius);
    border: 1px solid var(--nue-divider-color);
    box-shadow: var(--nue-secondary-shadow);

    &[data-actived='false'] {
        background-color: #f2f2f2;
    }

    &[data-actived='false'] > * {
        opacity: 0.8;
    }

    &[data-actived='false'] &__footer-ops,
    &[data-actived='false'] &__ops {
        opacity: 1;
    }
}
</style> -->
