<script setup lang="ts">
import { ref, watch } from 'vue'
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

// @watch 监听路由信息变化，当在 id 改变时重新加载数据（全流程）
watch(
    () => props.id,
    async () => {
        // 重置错误信息
        error.value = ''
        // 加载视图数据
        loading.value = true
        await tasksViewStore.loadViewProps(props.id, route.meta.category as string)
        loading.value = false
        // 判断 viewProps 是否存在
        if (!viewProps.value) {
            error.value = '视图数据加载失败'
            return
        }
        // 重置 viewProps.readyState
        viewProps.value.readyState = 1
    },
    { immediate: true }
)

// @watch
// watch(
//     () => [viewProps.value?.category, viewProps.value?.id] as const,
//     () => {
//         // 判断 viewProps 是否存在
//         if (!viewProps.value) return
//         // 重置 viewProps.readyState
//         viewProps.value.readyState = 1
//     },
//     { immediate: true }
// )
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
