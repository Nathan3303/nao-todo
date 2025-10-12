<script setup lang="ts">
import { ref, reactive, watchEffect } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useTasksViewStore } from '@/stores/tasks'
import { Loading as LoadingComp } from '@nao-todo/components'
import { storeToRefs } from 'pinia'

defineOptions({ name: 'TasksMainBasicWrapper' })
const props = defineProps<{ viewId?: string; todoId?: string }>()

const route = useRoute()
const router = useRouter()
const tasksViewStore = useTasksViewStore()

const loading = ref(true)
const error = reactive({ message: '', errorImage: '/images/error.png' })
const { viewProps } = storeToRefs(tasksViewStore)

// @effect 当路由信息变化重新加载数据
watchEffect(() => {
    // 判断 viewId 是否为空
    if (!props.viewId) {
        error.message = '参数错误'
        return
    }
    // 加载视图数据
    loading.value = true
    tasksViewStore
        .loadViewProps(props.viewId, route.meta.category as string)
        .then(() => {
            // 判断 viewProps 是否存在
            if (!viewProps.value) {
                error.message = '视图数据加载失败'
                return
            }
            // 重置错误信息
            error.message = ''
            // 跳转至指定视图
            router.replace({
                name: 'tasks-basic-main',
                params: { viewType: viewProps.value.preference.viewType }
            })
        })
        .finally(() => {
            loading.value = false
        })
})
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
