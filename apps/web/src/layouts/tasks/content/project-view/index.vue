<script setup lang="ts">
import useProjectView from './use-project-view'
import { Loading as LoadingComp } from '@nao-todo/components'
import type { TasksProjectViewProps } from './use-project-view'

defineOptions({ name: 'TasksProjectView' })
const props = defineProps<TasksProjectViewProps>()

const { loading, error } = useProjectView(props)
</script>

<template>
    <loading-comp v-if="loading" style="height: 100%" />
    <nue-empty
        v-else-if="error.message"
        :image-src="error.errorImage"
        image-size="3rem"
        :description="error.message"
        style="height: 100%"
    />
    <nue-container v-else id="TasksMainWrapper">
        <nue-header>
            <router-view name="Header" />
        </nue-header>
        <nue-main>
            <nue-content fill overflow="hidden">
                <router-view name="Content" />
            </nue-content>
        </nue-main>
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
