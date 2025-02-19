<template>
    <nue-div class="tasks-main-view__header__title-bar">
        <nue-div wrap="nowrap">
            <nue-div class="tasks-main-view__header__title-bar__title">
                <nue-tooltip
                    :content="`${pav ? '收起' : '展开'}菜单侧栏`"
                    placement="top-start"
                    size="small"
                >
                    <nue-button
                        :icon="pav ? 'menu-close' : 'menu-open'"
                        theme="icon-only"
                        @click="handleHideProjectAside"
                    />
                </nue-tooltip>
                <nue-text
                    :clamped="1"
                    size="24px"
                    theme="pointer"
                    @click="viewInfo?.handlers?.updateTitle"
                >
                    {{ category === 'tag' ? '#' : '' }}
                    {{ viewInfo?.title || '设置清单标题' }}
                </nue-text>
            </nue-div>
            <nue-div class="tasks-main-view__header__title-bar__actions">
                <slot name="actions" />
            </nue-div>
        </nue-div>
        <nue-text
            v-if="category === 'project'"
            color="gray"
            size="14px"
            theme="pointer"
            @click="viewInfo?.handlers?.updateDescription"
            :clamped="2"
        >
            {{ viewInfo?.description || '该清单没有设置描述信息，点此设置清单描述' }}
        </nue-text>
    </nue-div>
    <!-- <nue-div align="center" class="tasks-main-view__header__sub-bar" wrap="nowrap">
        <nue-div theme="view-type-switcher">
            <slot name="navigations" />
        </nue-div>
    </nue-div> -->
</template>

<script lang="ts" setup>
import { storeToRefs } from 'pinia'
import { useViewStore } from '@/stores'
import { useTasksViewStore } from '@/views/index/tasks'
import type { Project, Tag } from '@nao-todo/types'

defineOptions({ name: 'ContentHeader' })
defineProps<{
    title?: string
    subTitle?: string
    project?: Project | null
    tag?: Tag
}>()

const viewStore = useViewStore()
const tasksViewStore = useTasksViewStore()

const { projectAsideVisible: pav } = storeToRefs(viewStore)
const { category, viewInfo } = storeToRefs(tasksViewStore)

const handleHideProjectAside = () => viewStore.toggleProjectAsideVisible()
</script>
