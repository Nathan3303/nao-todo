<template>
    <nue-container id="AuthViewContainer">
        <nue-main>
            <nue-aside>
                <nue-div flex="1" justify="space-between" vertical>
                    <nue-text color="white" size="2rem">NaoTodo</nue-text>
                    <nue-text color="white" size="1rem">
                        使用专门为您量身定制的智能待办事项列表应用程序
                        NaoTodo，探索高效生活的新方式。无论是工作、学习还是日常生活，NaoTodo
                        都能帮助您轻松管理任务，提高生产力。凭借其直观的界面和强大的功能，您可以毫不费力地添加、编辑和跟踪任务、设置提醒，并且永远不会错过重要的细节。
                    </nue-text>
                </nue-div>
            </nue-aside>
            <nue-content fill>
                <router-view />
            </nue-content>
        </nue-main>
    </nue-container>
</template>

<script lang="ts" setup>
import { onMounted } from 'vue'
import { useViewStore } from '@/stores/use-view-store'

const viewStore = useViewStore()

onMounted(() => {
    viewStore.hideFirstLoadingScreen()
})
</script>

<style scoped>
.nue-aside {
    background-color: var(--nue-primary-color-900);
    padding: 2rem;
    width: 36%;
    min-width: unset;
    max-width: unset;
}

@media screen and (max-width: 768px) {
    .auth-view__main:deep(.nue-main__aside-wrapper) {
        display: none;
    }
}
</style>
