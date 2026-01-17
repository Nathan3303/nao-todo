<script setup lang="ts">
import { Loading as LoadingComp } from '@nao-todo/components'
import useTagView from './use-tag-view'
import type { TagViewProps } from './types'

defineOptions({ name: 'TasksTagView' })
const props = defineProps<TagViewProps>()

const { tagLoader, initialize } = useTagView(props)
</script>

<template>
    <loading-comp v-if="tagLoader.states.loading" style="height: 100%" />
    <nue-empty
        v-else-if="tagLoader.states.error.message"
        :image-src="tagLoader.states.error.errorImage"
        image-size="3rem"
        :description="tagLoader.states.error.message"
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
