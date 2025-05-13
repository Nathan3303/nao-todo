<template>
    <nue-div align="stretch" vertical>
        <nue-text color="gray" size="12px">
            "标签管理"能够清楚地展示出所有的标签，方便执行标签的增删改查。
        </nue-text>
        <nue-div align="center" justify="space-between">
            <tag-filter-bar :filter-options="filterInfo" @filter="handleFilter" />
            <nue-div gap="12px" width="fit-content">
                <nue-button
                    icon="plus-circle"
                    theme="small,primary"
                    @click="tasksDialogStore.showCreateTagDialog"
                >
                    新增
                </nue-button>
                <nue-button icon="refresh" theme="small" @click="getData" />
            </nue-div>
        </nue-div>
        <nue-div align="stretch" class="tag-manager" vertical>
            <tag-board
                :loading-state="loading"
                :tags="tags"
                @delete="tasksHandlerStore.handleDeleteTag"
                @recolor="tasksDialogStore.showTagColorSelectDialog"
            />
        </nue-div>
    </nue-div>
</template>

<script lang="ts" setup>
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { TagBoard, TagFilterBar } from '@nao-todo/components'
import { useTagStore } from '@/stores'
import { useTasksDialogStore, useTasksHandlerStore } from '@/views/tasks'
import type { GetTagsOptions, Tag } from '@nao-todo/types'

defineOptions({ name: 'TagManager' })

const tagStore = useTagStore()
const tasksDialogStore = useTasksDialogStore()
const tasksHandlerStore = useTasksHandlerStore()

const loading = ref(false)
const filterInfo = ref<GetTagsOptions>({})
const tags = ref<Tag[]>([])
let unSubscribe: () => void

const getData = () => {
    tags.value = tagStore.findTagsFromLocal(filterInfo.value, (key, tag, options) => {
        if (key === 'name') return tag.name.includes(options.name || '')
    })
}

const handleFilter = async (newFilterOptions: GetTagsOptions) => {
    filterInfo.value = newFilterOptions
    getData()
}

onMounted(() => {
    unSubscribe = tagStore.$subscribe((mutation) => {
        if (mutation.type !== 'direct') return
        setTimeout(() => getData())
    })
})

onBeforeUnmount(() => {
    if (unSubscribe) unSubscribe()
})

getData()
</script>

<style scoped>
@import url('./tag-manager.css');
</style>
