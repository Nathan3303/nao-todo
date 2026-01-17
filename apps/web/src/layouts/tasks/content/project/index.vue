<script setup lang="ts">
import { Loading as LoadingComp } from '@nao-todo/components'
import useProjectView from './use-project-view'
import type { ProjectViewProps } from './types'

defineOptions({ name: 'TasksProjectView' })
const props = defineProps<ProjectViewProps>()

const { projectLoader, initialize } = useProjectView(props)
</script>

<template>
    <loading-comp v-if="projectLoader.states.loading" style="height: 100%" />
    <nue-empty
        v-else-if="projectLoader.states.error.message"
        :image-src="projectLoader.states.error.errorImage"
        image-size="3rem"
        :description="projectLoader.states.error.message"
        style="height: 100%"
    >
        <nue-button theme="small,primary" @click="initialize">重试</nue-button>
    </nue-empty>
    <nue-container v-else id="TasksMainWrapper">
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
