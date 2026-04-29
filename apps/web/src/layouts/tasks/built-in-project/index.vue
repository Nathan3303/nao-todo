<script setup lang="ts">
import { Loading as LoadingComp } from '@nao-todo/components'
import useBuiltInProjectView from './built-in-project'
import type { BuiltInProjectViewProps } from './types'

defineOptions({ name: 'BuiltInProjectSection' })
const props = defineProps<BuiltInProjectViewProps>()

const { loading } = useBuiltInProjectView(props)
</script>

<template>
    <loading-comp v-if="loading" height="100%" />
    <nue-container v-else id="BuiltInProjectSectionWrapper">
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

