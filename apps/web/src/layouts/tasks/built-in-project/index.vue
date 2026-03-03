<script setup lang="ts">
import useBuiltInProjectView from './built-in-project'
import type { BuiltInProjectViewProps } from './types'

defineOptions({ name: 'TasksProjectView' })
const props = defineProps<BuiltInProjectViewProps>()

useBuiltInProjectView(props)
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

