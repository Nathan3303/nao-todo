<template>
    <nue-container>
        <nue-main>
            <nue-aside>
                <nue-div flex justify="space-between" vertical>
                    <nue-div align="center">
                        <nue-text color="white" size="32px">NaoTodo</nue-text>
                    </nue-div>
                    <nue-text color="white" size="16px">
                        使用专门为您量身定制的智能待办事项列表应用程序
                        NaoTodo，探索高效生活的新方式。无论是工作、学习还是日常生活，NaoTodo
                        都能帮助您轻松管理任务，提高生产力。凭借其直观的界面和强大的功能，您可以毫不费力地添加、编辑和跟踪任务、设置提醒，并且永远不会错过重要的细节。
                    </nue-text>
                </nue-div>
            </nue-aside>
            <nue-content fill style="padding: 2rem">
                <nue-div align="center" gap="0px" height="100%" vertical>
                    <nue-div align="center" height="0px" justify="end">
                        <nue-button @click="$router.push(switchRoute)">
                            {{ switchButtonText }}
                        </nue-button>
                    </nue-div>
                    <component :is="subView" :loading="loading" @submit="handleSubmit" />
                </nue-div>
            </nue-content>
        </nue-main>
    </nue-container>
</template>

<script lang="ts" setup>
import type { AuthViewProps } from './use-auth-view'
import useAuthView from './use-auth-view'

const props = defineProps<AuthViewProps>()

const { loading, switchButtonText, subView, switchRoute, handleSubmit } = useAuthView(props)
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
