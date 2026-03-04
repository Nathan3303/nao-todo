<script setup lang="ts">
import useBuiltInProjectView from './built-in-project'
import type { BuiltInProjectViewProps } from './types'

defineOptions({ name: 'BuiltInProjectSection' })
const props = defineProps<BuiltInProjectViewProps>()

useBuiltInProjectView(props)
</script>

<template>
    <nue-container id="BuiltInProjectSectionWrapper">
        <router-view name="Header" />
        <router-view name="Main" />
    </nue-container>
</template>

<style scoped>
.nue-container#BuiltInProjectSectionWrapper {
    padding: 1rem;
    gap: 0.5rem;

    > .nue-header,
    > .nue-main,
    > .nue-footer {
        padding: 0;
        border: none;
        height: auto;
    }
}
</style>

