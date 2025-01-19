<template>
    <nue-collapse-item name="tags">
        <template #header="{ collapse, state }">
            <nue-button :icon="state ? 'arrow-right' : 'arrow-down'" theme="pure" @click="collapse">
                <template #default>
                    <nue-div>
                        <nue-text size="12px">标签</nue-text>
                        <nue-text color="gray" size="12px"> {{ tags.length }}</nue-text>
                    </nue-div>
                </template>
            </nue-button>
            <nue-div gap="8px" width="fit-content">
                <nue-tooltip content="打开标签管理器" size="small">
                    <nue-button
                        icon="setting"
                        theme="pure"
                        @click.stop="() => tasksDialogStore.dialogManagerShow('TagManager')"
                    />
                </nue-tooltip>
                <nue-tooltip content="创建新标签" size="small">
                    <nue-button
                        id="create-tag-btn"
                        icon="plus"
                        theme="pure"
                        @click.stop="tasksDialogStore.showCreateTagDialog"
                    />
                </nue-tooltip>
            </nue-div>
        </template>

        <template v-if="tags && tags.length">
            <aside-link
                v-for="tag in tags"
                :key="tag.id"
                :route="{ name: 'tasks-tag', params: { tagId: tag.id } }"
                icon="tag"
            >
                {{ tag.name }}
                <template #append>
                    <tag-color-dot :color="tag.color" size="small" />
                </template>
            </aside-link>
        </template>
        <nue-text v-else class="nue-collapse-item__empty-text" color="#a5a5a5" size="11px">
            以标签的维度展示不同清单的待办任务。
        </nue-text>
    </nue-collapse-item>
</template>

<script lang="ts" setup>
import { computed } from 'vue'
import { useTagStore } from '@/stores'
import { AsideLink, TagColorDot } from '@nao-todo/components'
import { useTasksDialogStore } from '@/views/index/tasks'
import type { Tag } from '@nao-todo/types'

defineOptions({ name: 'TagSmartList' })

const tagStore = useTagStore()
const tasksDialogStore = useTasksDialogStore()

const tags = computed<Tag[]>(() => tagStore.findTagsFromLocal({}) || [])
</script>
