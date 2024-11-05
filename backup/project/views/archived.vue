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
import { ProjectContent } from '@nao-todo/layers/index'
import type { ProjectFilterOptions } from '@nao-todo/stores'

const filterInfo = ref<ProjectFilterOptions>({
    isArchived: true,
    isDeleted: false
})
</script>

<style scoped></style>
