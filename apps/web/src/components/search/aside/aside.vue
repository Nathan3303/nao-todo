<script setup lang="ts">
import { inject, nextTick, onMounted, ref, watch } from 'vue'
import { NuePrompt } from 'nue-ui'
import { t } from '@nao-todo/shared'
import { INDEX_VIEW_CONTEXT_KEY } from '@/views/index/context'
import { SEARCH_VIEW_CONTEXT_KEY } from '@/views/index/search/context'
import type { SavedSearch } from '../saved-search'

defineOptions({ name: 'SearchAside' })

// @contexts 搜索视图状态（单一真源）+ 首页壳（侧栏控制）
const {
    savedSearches,
    removeSavedSearch,
    renameSavedSearch,
    reorderSavedSearches,
    history,
    removeHistory,
    clearHistory,
    applyKeyword,
    applySavedSearch,
    focusSearchBox
} = inject(SEARCH_VIEW_CONTEXT_KEY)!
const { isDisplayAside, isUseFloatAside, setControllOption } = inject(INDEX_VIEW_CONTEXT_KEY)!

// 恢复侧栏显示：展开应用左侧子栏以承载常用搜索/最近搜索
onMounted(() => setControllOption({ useSlot: true, useDrawerSlot: true }))

/**
 * 侧栏延时传送：等待 #SubPageAsideTeleportSlot 渲染后再渲染 teleport
 */
const teleportDisabled = ref<boolean>(false)
watch(isDisplayAside, (nv) => nextTick(() => (teleportDisabled.value = !nv)))

// @method 复现（主区应用条件后回焦搜索框）
const handleApplySaved = (item: SavedSearch) => {
    applySavedSearch(item)
    focusSearchBox()
}
const handleApplyKeyword = (keyword: string) => {
    applyKeyword(keyword)
    focusSearchBox()
}

// @method 重命名（默认当前名可改；空名校验拦截）
const handleRename = async (item: SavedSearch) => {
    const [isByCancel, value] = await NuePrompt({
        title: t('search.saved.renameTitle'),
        inputValue: item.name,
        placeholder: t('search.saved.namePlaceholder'),
        confirmButtonText: t('common.save'),
        cancelButtonText: t('common.cancel'),
        validator: (input) =>
            typeof input === 'string' && input.trim() !== '' ? null : t('search.saved.nameRequired')
    })
    if (isByCancel) return
    renameSavedSearch(item.id, String(value ?? '').trim())
}

// @state 拖拽源下标（原生 HTML5 拖放；移动端隐藏手柄不启用）
const dragIndex = ref<number | null>(null)
const onDragStart = (index: number, event: DragEvent) => {
    dragIndex.value = index
    event.dataTransfer?.setData('text/plain', String(index))
}
const onDrop = (index: number) => {
    if (dragIndex.value !== null) reorderSavedSearches(dragIndex.value, index)
    dragIndex.value = null
}
</script>

<template>
    <teleport v-if="isDisplayAside && !teleportDisabled" to="#SubPageAsideTeleportSlot">
        <nue-div theme="aside-wrapper">
            <!-- 常用搜索（SEA-05；无条目不渲染标题） -->
            <nue-div v-if="savedSearches.length > 0" vertical class="search-saved">
                <nue-div align="center" class="search-saved__head">
                    <nue-text size="var(--nue-text-sm)" class="srch-tip">
                        {{ t('search.saved.title') }}
                    </nue-text>
                </nue-div>
                <nue-div vertical class="search-saved__list">
                    <nue-div
                        v-for="(item, index) in savedSearches"
                        :key="item.id"
                        align="center"
                        class="search-saved__item"
                        :draggable="!isUseFloatAside"
                        @dragstart="onDragStart(index, $event)"
                        @dragover.prevent
                        @drop="onDrop(index)"
                    >
                        <nue-button
                            v-if="!isUseFloatAside"
                            theme="icon,ghost,small"
                            icon="menu"
                            class="search-saved__handle"
                            :aria-label="t('search.saved.dragHandle')"
                        />
                        <nue-button
                            theme="small,ghost"
                            class="search-saved__reuse"
                            @click="handleApplySaved(item)"
                        >
                            {{ item.name }}
                        </nue-button>
                        <nue-button
                            theme="icon,ghost,small"
                            icon="edit"
                            :aria-label="t('search.saved.rename')"
                            @click="handleRename(item)"
                        />
                        <nue-button
                            theme="icon,ghost,small"
                            icon="clear"
                            :aria-label="t('search.saved.remove')"
                            @click="removeSavedSearch(item.id)"
                        />
                    </nue-div>
                </nue-div>
            </nue-div>

            <nue-divider v-if="savedSearches.length > 0 && history.length > 0" />

            <!-- 最近搜索（无历史不渲染标题） -->
            <nue-div v-if="history.length > 0" vertical class="search-history">
                <nue-div align="center" class="search-history__head">
                    <nue-text size="var(--nue-text-sm)" class="srch-tip">
                        {{ t('search.history.title') }}
                    </nue-text>
                    <nue-button
                        theme="small,ghost"
                        class="search-history__clear"
                        @click="clearHistory"
                    >
                        {{ t('search.history.clear') }}
                    </nue-button>
                </nue-div>
                <nue-div vertical class="search-history__list">
                    <nue-div
                        v-for="item in history"
                        :key="item"
                        align="center"
                        class="search-history__item"
                    >
                        <nue-button
                            theme="small,ghost"
                            class="search-history__reuse"
                            @click="handleApplyKeyword(item)"
                        >
                            {{ item }}
                        </nue-button>
                        <nue-button
                            theme="icon,ghost,small"
                            icon="clear"
                            :aria-label="t('search.history.remove')"
                            @click="removeHistory(item)"
                        />
                    </nue-div>
                </nue-div>
            </nue-div>
        </nue-div>
    </teleport>
</template>

<style scoped>
/* 颜色全走 shadlike 令牌（与主区一致） */
.srch-tip {
    color: var(--nue-secondary-text-color);
}

/* —— 常用搜索（SEA-05） —— */
.search-saved {
    width: 100%;
}
.search-saved__head {
    width: 100%;
    justify-content: space-between;
}
.search-saved__list {
    width: 100%;
    gap: var(--nue-gap-2xs);
}
.search-saved__item {
    width: 100%;
    gap: var(--nue-gap-2xs);
    border-radius: var(--nue-primary-radius);
}
.search-saved__item:hover {
    background: color-mix(in srgb, var(--nue-primary-text-color) 7%, var(--nue-primary-color-0));
}
.search-saved__handle {
    flex: none;
    cursor: grab;
}
.search-saved__reuse {
    flex: 1;
    min-width: 0;
    justify-content: flex-start;
    text-align: left;
}

/* —— 最近搜索（SEA-04 / S6） —— */
.search-history {
    width: 100%;
}
.search-history__head {
    width: 100%;
    justify-content: space-between;
}
.search-history__list {
    width: 100%;
    gap: var(--nue-gap-2xs);
}
.search-history__item {
    width: 100%;
    justify-content: space-between;
    border-radius: var(--nue-primary-radius);
}
.search-history__item:hover {
    background: color-mix(in srgb, var(--nue-primary-text-color) 7%, var(--nue-primary-color-0));
}
.search-history__reuse {
    flex: 1;
    min-width: 0;
    justify-content: flex-start;
    text-align: left;
}
</style>