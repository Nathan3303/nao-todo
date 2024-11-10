<template>
    <nue-container theme="vertical,inner" class="tasks-tag-view tasks-sub-view">
        <todo-view-header :tag="tag">
            <template #navigations>
                <nue-link theme="btnlike" :route="{ name: 'tasks-tag-table' }">列表视图</nue-link>
                <nue-link theme="btnlike" :route="{ name: 'tasks-tag-kanban' }">
                    看板视图
                </nue-link>
            </template>
        </todo-view-header>
        <nue-main style="border: none">
            <!-- <router-view></router-view> -->
        </nue-main>
    </nue-container>
</template>

<script setup lang="ts">
import { computed, provide } from 'vue'
import { TodoViewHeader } from '@nao-todo/layers'
import { useTodoStore, useTagStore } from '@nao-todo/stores'
import { TasksTagViewContextKey } from './constants'
import type { Tag } from '@nao-todo/stores'
import type { TasksTagViewContext } from './types'

const props = defineProps<{ tagId: Tag['id'] }>()

const todoStore = useTodoStore()
const tagStore = useTagStore()

const tag = computed(() => {
    const { tagId } = props
    const tag = tagStore.findLocal(tagId)
    todoStore.resetOptions()
    if (!tag) return void 0
    document.title = 'NaoTodo - #' + tag.name
    return tag as Tag
})

provide<TasksTagViewContext>(TasksTagViewContextKey, {
    tagId: computed(() => props.tagId),
    tag
})
</script>
