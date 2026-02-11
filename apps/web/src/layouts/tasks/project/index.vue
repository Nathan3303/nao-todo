<script setup lang="ts">
import useProjectView from './project'
import type { ProjectViewProps } from './types'

defineOptions({ name: 'TasksProjectView' })
const props = defineProps<ProjectViewProps>()

useProjectView(props)
</script>

<template>
    <nue-container id="TasksMainWrapper">
        <router-view name="Header" />
        <router-view name="Main" />
    </nue-container>
</template>

<style scoped>
.nue-container#TasksMainWrapper {
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

