<script setup lang="ts">
import { Loading as LoadingComp } from '@nao-todo/shared'
import useProjectView from './project'
import type { ProjectViewProps } from './types'

defineOptions({ name: 'ProjectSection' })
const props = defineProps<ProjectViewProps>()

const { loading } = useProjectView(props)
</script>

<template>
    <loading-comp v-if="loading" height="100%" />
    <nue-container v-else id="ProjectSectionWrapper">
        <router-view name="Header" />
        <router-view name="Main" />
    </nue-container>
</template>

<style scoped>
.nue-container#ProjectSectionWrapper {
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