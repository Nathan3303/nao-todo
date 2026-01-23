<script setup lang="ts">
// import { Loading as LoadingComp } from '@nao-todo/components'
import useBuiltInProjectView from './built-in-project'
import type { BuiltInProjectViewProps } from './types'

defineOptions({ name: 'TasksProjectView' })
const props = defineProps<BuiltInProjectViewProps>()

// const { builtInProjectLoader, initialize } =
useBuiltInProjectView(props)
</script>

<template>
    <!-- <loading-comp v-if="builtInProjectLoader.states.loading" style="height: 100%" />
    <nue-empty
        v-else-if="builtInProjectLoader.states.error.message"
        :image-src="builtInProjectLoader.states.error.errorImage"
        image-size="3rem"
        :description="builtInProjectLoader.states.error.message"
        style="height: 100%"
    >
        <nue-button theme="small,primary" @click="initialize">重试</nue-button>
    </nue-empty> -->
    <!-- <nue-container v-else id="TasksMainWrapper"> -->
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

