<script setup lang="ts">
import { ref, reactive, watch } from 'vue'
import { useTasksViewStore } from '@/views/index/tasks'
import { Loading as LoadingComp } from '@nao-todo/components'
import { unwrapError } from '@nao-todo/utils'
import type { ProjectVO, WithNull } from '@nao-todo/types'

defineOptions({ name: 'TasksMainBasicWrapper' })
const props = defineProps<{ viewId?: string; todoId?: string }>()

const tasksViewStore = useTasksViewStore()

const loading = ref(true)
const error = reactive({ message: '', errorImage: '/images/error.png' })
const project = ref<WithNull<ProjectVO>>(null)

// @watch 监听路由信息变化，当在 id 改变时重新加载数据
watch(
    () => props.viewId,
    async (newId) => {
        if (!newId) {
            error.message = '参数错误'
            return
        }
        loading.value = true
        const [projectVO, err] = await tasksViewStore.projectApp.getProjectById(newId)
        if (err !== null) {
            error.message = unwrapError(err)
            loading.value = false
            return
        }
        project.value = projectVO
        loading.value = false
    },
    { immediate: true }
)

// @provide
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
