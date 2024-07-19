<template>
    <nue-container class="tasks-all-view">
        <nue-header>
            <nue-div align="center" justify="space-between" wrap="nowrap">
                <nue-div vertical width="fit-content" gap="4px" flex>
                    <nue-div align="center" width="fit-content" gap="8px">
                        <nue-button
                            theme="icon-only"
                            icon="more2"
                            @click="handleHideProjectAside"
                            style="--icon-size: 22px"
                        ></nue-button>
                        <nue-text size="24px"> 所有 </nue-text>
                    </nue-div>
                    <nue-text size="14px" color="gray">
                        "所有"
                        板块是一个集中展示和管理所有任务的区域，你可以查看当前所有进行中的任务、即将到期的任务以及已完成的任务。
                    </nue-text>
                </nue-div>
                <nue-div align="center" justify="end" width="fit-content" gap="8px"></nue-div>
            </nue-div>
            <nue-div wrap="nowrap" align="center">
                <nue-div class="project-navigations">
                    <nue-link theme="btnlike" :route="{ name: 'tasks-all-table' }">
                        任务列表
                    </nue-link>
                    <nue-link theme="btnlike" :route="{ name: 'tasks-all-kanban' }">
                        任务看板
                    </nue-link>
                </nue-div>
            </nue-div>
        </nue-header>
        <nue-main>
            <router-view></router-view>
        </nue-main>
    </nue-container>
</template>

<script setup lang="ts">
import { useViewStore } from '@/stores'

defineOptions({ name: 'TasksAllView' })

const viewStore = useViewStore()

const handleHideProjectAside = () => {
    viewStore.toggleProjectAsideVisible()
}
</script>

<style scoped>
@import url('./index.css');
</style>
