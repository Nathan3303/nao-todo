<script setup lang="ts">
import { NaoSmartList } from '@nao-todo/shared/components/smart-list'
import {
    PROJECT_CREATOR_DIALOG_KEY,
    PROJECT_MANAGER_DIALOG_KEY,
    TAG_CREATOR_DIALOG_KEY,
    TAG_MANAGER_DIALOG_KEY
} from '@nao-todo/shared/constants'
import { ref, inject, watch, computed, nextTick, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import useCalendarSmartList from './use-calendar-smart-list'
import { t } from '@nao-todo/shared/locales'
import CalendarViewSwitch from '../view-switch.vue'
import CalendarSegmentedSwitch from '../segmented-switch.vue'
import {
    resolveViewSwitch,
    viewModeOfRouteName,
    type CalendarViewName
} from '@/views/index/calendar/view-routes'
import { CALENDAR_VIEW_CONTEXT_KEY } from '@/views/index/calendar/context'
import { INDEX_VIEW_CONTEXT_KEY } from '@/views/index/context'

defineOptions({ name: 'CalendarAside' })

const { isDisplayAside, dialogManager, hideCompleted, weekStart, setWeekStart, pomodoroBadge } =
    inject(CALENDAR_VIEW_CONTEXT_KEY)!
const { setControllOption } = inject(INDEX_VIEW_CONTEXT_KEY)!
const { projectOptions, tagOptions, selectedProjectIds, selectedTagIds } = useCalendarSmartList()
const collapseItemsRecord = ref(['projects', 'tags'])

// @viewSwitch 侧边栏顶部的子视图切换（T445 ①）：route.name 派生当前态，`router.replace` 切换
const route = useRoute()
const router = useRouter()
const viewMode = computed(() => viewModeOfRouteName(route?.name))
const switchCalendarView = (name: CalendarViewName): void => {
    if (!router || !route) return
    const target = resolveViewSwitch(router, route, name)
    if (!target) return
    void router.replace(target)
}

// 恢复侧边栏显示：与任务页 aside 一致，展开应用左侧子栏以承载筛选内容
onMounted(() => setControllOption({ useSlot: true, useDrawerSlot: true }))

// @computed 周起始分段件段定义（T512）：2 段，选中态由 `weekStart` 驱动，点击调 `setWeekStart`
const weekStartItems = computed(() => [
    { label: t('calendar.sunday'), value: 'sunday' },
    { label: t('calendar.monday'), value: 'monday' }
])
const onWeekStartChange = (value: string): void => {
    if (value === 'sunday' || value === 'monday') setWeekStart(value)
}

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
            <calendar-view-switch
                variant="segmented"
                :current="viewMode"
                :on-switch="switchCalendarView"
            />
            <!-- T445 ① 子视图切换（月/周/日）落侧边栏顶部；其下分割线与既有区块一致 -->
            <nue-div class="view-switch-row">
                <nue-div class="weekstart-row" gap="8px">
                    <nue-text size="var(--nue-text-sm)" class="weekstart-label">
                        {{ t('calendar.weekStart') }}
                    </nue-text>
                    <calendar-segmented-switch
                        :fill="false"
                        :items="weekStartItems"
                        :model-value="weekStart"
                        :aria-label="t('calendar.weekStart')"
                        @update:model-value="onWeekStartChange"
                    />
                </nue-div>
                <nue-checkbox v-model="hideCompleted">隐藏已完成</nue-checkbox>
                <!-- B1-F5 专注徽标开关（off=停拉区间记录；即时生效并持久化） -->
                <nue-checkbox v-model="pomodoroBadge">专注徽标</nue-checkbox>
            </nue-div>
            <nue-divider />
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
        </nue-div>
    </teleport>
</template>

<style scoped>
.nue-div--aside-wrapper {
    flex: auto;

    /* 顶部视图切换（T445 ①）+ 周起始（T512）：分段视觉/交互由通用件 `segmented-switch` 承担。
       下方留白与既有观感一致（toggle 底距 = padding-sm）；分段宽度策略：日/月/周铺满（fill），周起始自适应。 */
    > .view-switch-row {
        width: 100%;
        display: flex;
        flex-direction: column;
        gap: 0;
        flex: none;

        /* 与 smart-list 内 checkbox 一致：默认字号/色值 + 去除默认横向内距保持左对齐 */
        > .nue-checkbox {
            padding: 0;
        }

        > .weekstart-row {
            width: 100%;
            align-items: center;
            justify-content: space-between;
            height: var(--nue-box-size-df);

            .weekstart-label {
                color: var(--nue-primary-color-700);
            }
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