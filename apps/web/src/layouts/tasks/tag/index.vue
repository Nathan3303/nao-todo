<script setup lang="ts">
import useTagView from './tag'
import type { TagViewProps } from './types'

defineOptions({ name: 'TagSection' })
const props = defineProps<TagViewProps>()

useTagView(props)
</script>

<template>
    <nue-container id="TagSectionWrapper">
        <router-view name="Header" />
        <router-view name="Main" />
    </nue-container>
</template>

<style scoped>
.nue-container#TagSectionWrapper {
    padding: 1rem;
    gap: 0.25rem;

    > .nue-header,
    > .nue-main,
    > .nue-footer {
        padding: 0;
        border: none;
        height: auto;
    }
}
</style>

