<script setup lang="ts">
import {
    NaoSmartList,
    PROJECT_CREATOR_DIALOG_KEY,
    PROJECT_MANAGER_DIALOG_KEY,
    TAG_CREATOR_DIALOG_KEY,
    TAG_MANAGER_DIALOG_KEY
} from '@nao-todo/shared'
import { ref, inject, watch, nextTick, onMounted } from 'vue'
import useCalendarSmartList from './use-calendar-smart-list'
import { CALENDAR_VIEW_CONTEXT_KEY } from '@/views/index/calendar/context'
import { INDEX_VIEW_CONTEXT_KEY } from '@/views/index/context'

defineOptions({ name: 'CalendarAside' })

const { isDisplayAside, dialogManager, hideCompleted } = inject(CALENDAR_VIEW_CONTEXT_KEY)!
const { setControllOption } = inject(INDEX_VIEW_CONTEXT_KEY)!
const { projectOptions, tagOptions, selectedProjectIds, selectedTagIds } = useCalendarSmartList()
const collapseItemsRecord = ref(['projects', 'tags'])

// 恢复侧边栏显示：与任务页 aside 一致，展开应用左侧子栏以承载筛选内容
onMounted(() => setControllOption({ useSlot: true, useDrawerSlot: true }))

/**
 * 处理侧边栏延时传送
 * 等待侧边栏的 SubPageAsideTeleportSlot 元素渲染后再渲染 teleport
 */
const teleportDisabled = ref<boolean>(false)
watch(isDisplayAside, (nv) => nextTick(() => (teleportDisabled.value = !nv)))
</script>

<template>
    <teleport v-if="isDisplayAside && !teleportDisabled" to="#SubPageAsideTeleportSlot">
        <nue-div theme="aside-wrapper">
            <nue-div theme="smart-list-wrapper">
                <nue-collapse v-model="collapseItemsRecord" theme="menu">
                    <nao-smart-list
                        collapse-item-name="projects"
                        name="清单"
                        :count="projectOptions.length"
                        manage-btn-tooltip="管理清单"
                        create-btn-tooltip="新建清单"
                        @manage="dialogManager.open(PROJECT_MANAGER_DIALOG_KEY)"
                        @create="dialogManager.open(PROJECT_CREATOR_DIALOG_KEY)"
                    >
                        <template #actions></template>
                        <nue-checkbox-group v-model="selectedProjectIds">
                            <nue-checkbox
                                v-for="p in projectOptions"
                                :key="p.id"
                                :name="p.id"
                                :label="p.name"
                            />
                        </nue-checkbox-group>
                    </nao-smart-list>
                    <nao-smart-list
                        collapse-item-name="tags"
                        name="标签"
                        :count="tagOptions.length"
                        manage-btn-tooltip="管理标签"
                        create-btn-tooltip="新建标签"
                        @manage="dialogManager.open(TAG_MANAGER_DIALOG_KEY)"
                        @create="dialogManager.open(TAG_CREATOR_DIALOG_KEY)"
                    >
                        <template #actions></template>
                        <nue-checkbox-group v-model="selectedTagIds">
                            <nue-checkbox
                                v-for="t in tagOptions"
                                :key="t.id"
                                :name="t.id"
                                :label="t.name"
                            />
                        </nue-checkbox-group>
                    </nao-smart-list>
                </nue-collapse>
            </nue-div>
            <!-- <nue-divider />
            <nue-div align="center" justify="space-between" class="hide-completed-row">
                <nue-text size="var(--nue-text-df2)">隐藏已完成任务</nue-text>
                <nue-switch v-model="hideCompleted" size="small" />
            </nue-div> -->
        </nue-div>
    </teleport>
</template>

<style scoped>
.nue-div--aside-wrapper {
    flex: auto;

    > .hide-completed-row {
        width: 100%;
        padding: 0.375rem 0.25rem;
        gap: 0.5rem;

        .nue-switch {
            flex-shrink: 0;
        }
    }

    > .nue-div--smart-list-wrapper {
        width: 100%;
        flex-direction: column;

        .nue-collapse--menu {
            gap: 0;

            .nue-collapse-item {
                border: none;
            }

            .nue-checkbox {
                padding: 0;
            }
        }
    }
}
</style>