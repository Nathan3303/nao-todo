<template>
    <project-content title="所有" :filter-info="filterInfo">
        <template #subTitle>
            “所有” 板块是用来管理你创建的项目清单。在这个板块中，你可以查看、编辑、删除你的项目。
        </template>
    </project-content>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { ProjectContent } from '@nao-todo/layers/index'
import type { ProjectFilterOptions } from '@nao-todo/stores'

const filterInfo = ref<ProjectFilterOptions>({
    isDeleted: false,
    isArchived: false
})
</script>

<style scoped></style>
