<template>
    <nue-container class="tasks-tag-view tasks-sub-view">
        <todo-view-header :tag="tag">
            <template #navigations>
                <nue-link theme="btnlike" :route="{ name: 'tasks-tag-table' }"> 任务列表 </nue-link>
                <nue-link theme="btnlike" :route="{ name: 'tasks-tag-kanban' }">
                    任务看板
                </nue-link>
            </template>
        </todo-view-header>
        <nue-main>
            <router-view></router-view>
        </nue-main>
    </nue-container>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { TodoViewHeader } from '@/layers'
import { useTagStore } from '@/stores'
import type { Tag } from '@/stores'

const props = defineProps<{ tagId: Tag['id'] }>()

const tagStore = useTagStore()

const tag = computed(() => {
    const { tagId } = props
    const tag = tagStore.findLocal(tagId)
    if (!tag) return void 0
    document.title = 'NaoTodo - #' + tag.name
    return tag as Tag
})
</script>

<style scoped>
@import url('../common/index.css');
/* @import url('./index.css'); */
</style>
