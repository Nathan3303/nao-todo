<script setup lang="ts">
import { ref, reactive, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useTasksViewStore } from '@/stores/tasks'
import { Loading as LoadingComp } from '@nao-todo/components'
import { storeToRefs } from 'pinia'

defineOptions({ name: 'TasksMainProjectWrapper' })
const props = defineProps<{ projectId?: string; todoId?: string }>()

const route = useRoute()
const router = useRouter()
const tasksViewStore = useTasksViewStore()

const loading = ref(true)
const error = reactive({ message: '', errorImage: '/images/error.png' })
const { viewProps } = storeToRefs(tasksViewStore)

// @watch 监听路由信息变化，当在 id 改变时重新加载数据（全流程）
watch(
    () => props.projectId,
    async (newId) => {
        // 判断 projectId 是否为空
        if (!newId) {
            error.message = '参数错误'
            return
        }
        // 加载视图数据
        loading.value = true
        await tasksViewStore.loadViewProps(newId, route.meta.category as string)
        loading.value = false
        // 判断 viewProps 是否存在
        if (!viewProps.value) {
            error.message = '视图数据加载失败'
            return
        }
        // debug
        // console.log('TasksBasic', viewProps.value)
        // 重置错误信息
        error.message = ''
        // 跳转至 指定视图
        router.replace({
            name: 'tasks-project-main',
            params: { viewType: viewProps.value.preference.viewType }
        })
    },
    { immediate: true }
)
</script>

<template>
    <loading-comp v-if="loading" style="height: 100%" />
    <nue-empty
        v-else-if="error.message"
        :image-src="error.errorImage"
        image-size="4rem"
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
