<template>
    <project-content title="已归档清单" :filter-info="filterInfo">
        <template #subTitle>
            “已归档清单” 板块是一个专门用于存储和管理已经完成或不再需要积极跟进的任务和项目的区域。
            通过将完成的任务归档，你可以保持当前工作空间的整洁和有序，同时也可以在需要时轻松找到和查看过去的工作成果。
        </template>
    </project-content>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useProjectStore } from '@/stores'
import { ProjectContent } from '@/layers/index'
import { NueMessage, NueConfirm } from 'nue-ui'
import type { Project, ProjectFilterOptions } from '@/stores'

const projectStore = useProjectStore()

const projectBoardLoading = ref(false)
const filterInfo = ref<ProjectFilterOptions>({
    isDeleted: false,
    isArchived: true
})

const handleUnarchiveProject = async (projectId: Project['id']) => {
    NueConfirm({
        title: '取消项目归档确认',
        content: '确定要取消项目归档吗？',
        confirmButtonText: '确定',
        cancelButtonText: '取消'
    }).then(
        async () => {},
        () => NueMessage.info('操作取消')
    )
}
</script>

<style scoped>
.project-archived-view {
    gap: 16px;

    .nue-header {
        padding: 0px;
        height: auto;
        border-bottom: none;
    }

    .nue-main {
        display: flex;
        flex-direction: column;
        align-items: stretch;
        padding: 0px;

        .nue-button--unarchived:deep(.nue-icon)::after {
            display: block;
            width: 100%;
            height: 2px;
            background-color: #007aff;
            content: '';
            position: absolute;
            transform: rotate(45deg);
            top: 4px;
            left: 1px;
        }
    }
}
</style>
