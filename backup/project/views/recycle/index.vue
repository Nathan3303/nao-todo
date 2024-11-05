<template>
    <project-content title="垃圾桶" :filter-info="filterInfo">
        <template #subTitle>
            “垃圾桶”
            板块是用来管理你已删除的项目清单。在这个板块中，你可以选择性地恢复已删除的项目，也可以永久删除你的项目。
        </template>
    </project-content>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { ProjectContent } from '@nao-todo/layers/index'
import type { ProjectFilterOptions } from '@nao-todo/stores'

const filterInfo = ref<ProjectFilterOptions>({
    isDeleted: true
})
</script>

<style scoped></style>
