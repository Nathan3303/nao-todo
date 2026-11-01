<script setup lang="ts">
import { computed } from 'vue'
import { SegmentedSwitch } from '@nao-todo/shared/components/segmented-switch'
import { t } from '@nao-todo/shared/locales'
import { useKanbanGroup, type KanbanGroupBy } from './use-kanban-group'

/**
 * 看板分组切换（`T613` 控件搬家）
 * @description **包装** `SegmentedSwitch`（`DESIGN §4.5` 单一来源件），不自绘分段；
 *              分组状态经 `KANBAN_GROUP_BY_KEY` 注入（与看板读同一份 ref · PRD R-D）。
 *              三处右上角「视图」菜单共用本件（同一实现，非三份复制）。
 */
defineOptions({ name: 'KanbanGroupSwitch' })

const groupBy = useKanbanGroup()

// @computed 两段文案（复用既有 i18n 键，不新增）
const groupByOptions = computed(() => [
    { value: 'state' as const, label: t('task.kanban.groupByState') },
    { value: 'priority' as const, label: t('task.kanban.groupByPriority') }
])

// @method 切换分组（分段件只上抛段值 ⇒ 此处收窄回分组枚举；不持久化 —— PRD R-C）
const handleGroupByChange = (value: string) => {
    if (value === 'state' || value === 'priority') groupBy.value = value as KanbanGroupBy
}
</script>

<template>
    <!-- 根元素带 `data-kanban-group-switch`（`T612` 接缝；单根 ⇒ 紧跟「看板视图」条目） -->
    <div data-kanban-group-switch>
        <segmented-switch
            size="md"
            :items="groupByOptions"
            :model-value="groupBy"
            :aria-label="t('task.kanban.groupByLabel')"
            @update:model-value="handleGroupByChange"
        />
    </div>
</template>