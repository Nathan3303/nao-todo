<script setup lang="ts">
import { Loading as LoadingComp } from '@nao-todo/shared'
import useTagView from './tag'
import type { TagViewProps } from './types'

defineOptions({ name: 'TagSection' })
const props = defineProps<TagViewProps>()

const { loading } = useTagView(props)
</script>

<template>
    <loading-comp v-if="loading" height="100%" />
    <nue-container v-else id="TagSectionWrapper">
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

