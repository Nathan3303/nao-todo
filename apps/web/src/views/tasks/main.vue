<script setup lang="ts">
import { ref, watchEffect } from 'vue'
import { useRoute } from 'vue-router'
import { TasksMain, TasksMainHeader } from '@/layouts/tasks'
import { useTasksViewStore } from '@/stores/tasks'
import { Loading as LoadingComp } from '@nao-todo/components'
import { storeToRefs } from 'pinia'

const props = defineProps<{ id: string }>()

const route = useRoute()
const tasksViewStore = useTasksViewStore()

const loading = ref(true)
const error = ref('')
const { viewProps } = storeToRefs(tasksViewStore)

watchEffect(async () => {
    // 加载视图数据
    await tasksViewStore.loadViewProps(props.id, route.meta.category as string)
    // 恢复加载状态
    loading.value = false
})
</script>

<template>
    <loading-comp v-if="loading" style="height: 100%" />
    <nue-empty v-else-if="error || !viewProps" description="暂无数据" style="height: 100%" />
    <nue-container v-else id="TasksMainWrapper">
        <nue-header>
            <tasks-main-header />
        </nue-header>
        <nue-main>
            <nue-content fill overflow="hidden">
                <tasks-main />
            </nue-content>
        </nue-main>
    </nue-container>
</template>

<style scoped>
.nue-container#TasksMainWrapper {
    padding: 1rem;
    gap: 1rem;

    > .nue-header,
    > .nue-main,
    > .nue-footer {
        padding: 0;
        border: none;
        height: auto;
    }
}
</style>
