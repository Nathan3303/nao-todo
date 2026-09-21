<script setup lang="ts">
import { nextTick, onMounted, ref, watch } from 'vue'
import { NuePrompt } from 'nue-ui'
import { t } from '@nao-todo/shared'
import type { SavedSearch } from '../saved-search'
import { QUICK_SEARCH_PRESETS, type QuickSearchPreset } from '../quick-search'
import useAside, {
    ASIDE_RECENT_CONTENT_ID,
    ASIDE_SAVED_CONTENT_ID,
    ASIDE_SECTION_RECENT,
    ASIDE_SECTION_SAVED
} from './use-aside'

defineOptions({ name: 'SearchAside' })

// @hook 侧栏组合式（注入搜索视图上下文 + 首页壳上下文 + 折叠状态）
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
    focusSearchBox,
    isDisplayAside,
    isUseFloatAside,
    setControllOption,
    collapseItemsRecord
} = useAside()

// @const 只读快捷搜索预置（零模型改动：仅优先级 / 状态）
const quickSearchPresets = QUICK_SEARCH_PRESETS

// 恢复侧栏显示：展开应用左侧子栏以承载快捷搜索/常用搜索/最近搜索
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
// 预置项复用 applySavedSearch：以瞬态条目承载条件（回调仅消费 query）
const handleApplyQuick = (preset: QuickSearchPreset) => {
    applySavedSearch({
        id: preset.id,
        name: t(preset.nameKey),
        query: preset.query,
        createdAt: ''
    })
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
            <!-- 快捷搜索（只读预置；固定常显，不折叠） -->
            <nue-div vertical class="search-quick">
                <nue-div align="center" class="search-quick__head">
                    <nue-text size="var(--nue-text-xs)">
                        {{ t('search.quick.title') }}
                    </nue-text>
                </nue-div>
                <nue-div class="search-quick__list" wrap="wrap">
                    <nue-button
                        v-for="preset in quickSearchPresets"
                        :key="preset.id"
                        theme="small"
                        :icon="preset.icon"
                        class="search-quick__item"
                        @click="handleApplyQuick(preset)"
                    >
                        {{ t(preset.nameKey) }}
                    </nue-button>
                </nue-div>
            </nue-div>

            <nue-divider />

            <!-- 常用搜索 / 最近搜索：可折叠（默认展开，非 accordion，不持久化） -->
            <nue-collapse v-model="collapseItemsRecord" theme="menu" class="search-aside__collapse">
                <!-- 常用搜索（标题恒显示，空态给文案 + 引导） -->
                <nue-collapse-item
                    :name="ASIDE_SECTION_SAVED"
                    theme="menu"
                    class="search-aside__section search-saved"
                >
                    <template #header="{ collapse, state }">
                        <nue-div
                            class="search-aside__header"
                            role="button"
                            tabindex="0"
                            :aria-expanded="!state"
                            :aria-controls="ASIDE_SAVED_CONTENT_ID"
                            @click="collapse"
                            @keydown.enter.self.prevent="collapse"
                            @keydown.space.self.prevent="collapse"
                        >
                            <nue-button
                                theme="small,pure"
                                :icon="state ? 'arrow-right' : 'arrow-down'"
                            >
                                {{ t('search.saved.title') }}
                                <template v-if="savedSearches.length" #append>
                                    <nue-text size="xs">{{ savedSearches.length }}</nue-text>
                                </template>
                            </nue-button>
                        </nue-div>
                    </template>
                    <div :id="ASIDE_SAVED_CONTENT_ID" class="search-aside__body">
                        <nue-div
                            v-if="savedSearches.length > 0"
                            vertical
                            class="search-saved__list"
                        >
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
                                <nue-text
                                    class="search-saved__reuse"
                                    @click="handleApplySaved(item)"
                                    :clamped="1"
                                >
                                    {{ item.name }}
                                </nue-text>
                                <nue-div class="search-saved__item__actions">
                                    <nue-icon
                                        name="edit"
                                        :aria-label="t('search.saved.rename')"
                                        @click="handleRename(item)"
                                    />
                                    <nue-icon
                                        name="clear"
                                        :aria-label="t('search.saved.remove')"
                                        @click="removeSavedSearch(item.id)"
                                    />
                                </nue-div>
                            </nue-div>
                        </nue-div>
                        <nue-div v-else vertical class="search-empty-block">
                            <nue-text size="var(--nue-text-xs)" class="srch-tip">
                                {{ t('search.saved.empty') }}
                            </nue-text>
                            <nue-text size="var(--nue-text-xs)" class="srch-tip">
                                {{ t('search.saved.emptyHint') }}
                            </nue-text>
                        </nue-div>
                    </div>
                </nue-collapse-item>

                <!-- 最近搜索（标题恒显示，空态给文案） -->
                <nue-collapse-item
                    :name="ASIDE_SECTION_RECENT"
                    theme="menu"
                    class="search-aside__section search-history"
                >
                    <template #header="{ collapse, state }">
                        <nue-div
                            class="search-aside__header"
                            role="button"
                            tabindex="0"
                            :aria-expanded="!state"
                            :aria-controls="ASIDE_RECENT_CONTENT_ID"
                            @click="collapse"
                            @keydown.enter.self.prevent="collapse"
                            @keydown.space.self.prevent="collapse"
                        >
                            <nue-button
                                theme="small,pure"
                                :icon="state ? 'arrow-right' : 'arrow-down'"
                            >
                                {{ t('search.history.title') }}
                                <template v-if="history.length" #append>
                                    <nue-text size="xs">{{ history.length }}</nue-text>
                                </template>
                            </nue-button>
                            <nue-div
                                class="search-aside__header-actions"
                                align="center"
                                gap="var(--nue-gap-2xs)"
                            >
                                <nue-button
                                    v-if="history.length > 0"
                                    theme="small,pure"
                                    class="search-history__clear"
                                    @click.stop="clearHistory"
                                >
                                    {{ t('search.history.clear') }}
                                </nue-button>
                            </nue-div>
                        </nue-div>
                    </template>
                    <div :id="ASIDE_RECENT_CONTENT_ID" class="search-aside__body">
                        <nue-div v-if="history.length > 0" vertical>
                            <nue-div vertical class="search-history__list">
                                <nue-div
                                    v-for="item in history"
                                    :key="item"
                                    align="center"
                                    class="search-history__item"
                                >
                                    <nue-text
                                        :clamped="1"
                                        theme="small,ghost"
                                        class="search-history__reuse"
                                        @click="handleApplyKeyword(item)"
                                    >
                                        {{ item }}
                                    </nue-text>
                                    <nue-button
                                        theme="icon,pure,small"
                                        icon="clear"
                                        :aria-label="t('search.history.remove')"
                                        @click="removeHistory(item)"
                                    />
                                </nue-div>
                            </nue-div>
                        </nue-div>
                        <nue-div v-else vertical class="search-empty-block">
                            <nue-text size="var(--nue-text-xs)" class="srch-tip">
                                {{ t('search.history.empty') }}
                            </nue-text>
                        </nue-div>
                    </div>
                </nue-collapse-item>
            </nue-collapse>
        </nue-div>
    </teleport>
</template>

<style scoped>
/* —— 折叠区（快捷搜索不折叠） —— */
.search-aside__collapse {
    width: 100%;

    .search-aside__section {
        width: 100%;
        border: none;
    }

    .search-aside__header {
        width: 100%;
        display: flex;
        align-items: center;
        cursor: pointer;
        gap: var(--nue-gap-xs);
        justify-content: space-between;

        > .nue-button {
            gap: var(--nue-gap-xs);
        }

        .search-aside__header-actions {
            flex: none;
        }
    }

    /* R3：不传 maxHeight ⇒ 内容高度由 scrollHeight 过渡，transitionend 后回到 auto，
   展开态下的增删不会因固定高度被裁切（jsdom 无过渡，仅断言 DOM 存在性） */
    .search-aside__body {
        width: 100%;
    }
}

/* —— 快捷搜索（只读预置） —— */
.search-quick {
    width: 100%;

    .search-quick__head {
        width: 100%;
        justify-content: space-between;
    }

    .search-quick__list {
        width: 100%;
        gap: var(--nue-gap-xs);
    }

    .search-quick__item {
        justify-content: flex-start;
        text-align: left;
    }
}

/* —— 空态文案（两区共用） —— */
.search-empty-block {
    width: 100%;
    gap: var(--nue-gap-2xs);
    padding: var(--nue-padding-xs) var(--nue-padding-sm);
    background-color: var(--nue-primary-color-100);
    border-radius: var(--nue-primary-radius);
    color: var(--nue-primary-color-700);
}

/* —— 常用搜索（SEA-05） —— */
.search-saved__list {
    width: 100%;
    gap: var(--nue-gap-2xs);

    .search-saved__item {
        width: 100%;
        border-radius: var(--nue-primary-radius);
        font-size: var(--nue-text-xs);
        padding: var(--nue-padding-xs) var(--nue-padding-sm);

        &:hover {
            cursor: pointer;
            background: color-mix(
                in srgb,
                var(--nue-primary-text-color) 7%,
                var(--nue-primary-color-0)
            );
        }

        .search-saved__item__actions {
            gap: var(--nue-gap-xs);
        }
    }
}

/* —— 最近搜索（SEA-04 / S6） —— */
.search-history__list {
    width: 100%;
    gap: var(--nue-gap-2xs);

    .search-history__item {
        width: 100%;
        border-radius: var(--nue-primary-radius);
        font-size: var(--nue-text-xs);
        padding: var(--nue-padding-xs) var(--nue-padding-sm);

        &:hover {
            background: color-mix(
                in srgb,
                var(--nue-primary-text-color) 7%,
                var(--nue-primary-color-0)
            );
        }
    }
}

.search-saved__reuse,
.search-history__reuse {
    flex: 1;
    min-width: 0;
    justify-content: flex-start;
    text-align: left;
}
</style>