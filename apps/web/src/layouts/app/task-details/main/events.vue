<script setup lang="ts">
import { InputButton, EventRow, Loading } from '@nao-todo/components'
import useEventDragger from '../use-event-dragger'
import { TASK_DETAILS_CONTEXT_KEY } from '../context'
import { computed, inject, ref, watch } from 'vue'
import { t } from '@nao-todo/infrastructure/locales'

type FilterStatus = 'all' | 'undone' | 'done'

const {
    vo,
    checkItems,
    resortCheckItems,
    checkItemHandler,
    checkItemsLoading,
    checkItemsError,
    retryCheckItems,
    makeCheckItemToTask
} = inject(TASK_DETAILS_CONTEXT_KEY)!

const searchQuery = ref('')
const filterStatus = ref<FilterStatus>('all')

const filteredCheckItems = computed(() => {
    let result = checkItems.value
    if (filterStatus.value === 'undone') {
        result = result.filter((event) => !event.isDone)
    } else if (filterStatus.value === 'done') {
        result = result.filter((event) => event.isDone)
    }
    if (searchQuery.value.trim()) {
        const query = searchQuery.value.toLowerCase()
        result = result.filter((event) => event.name.toLowerCase().includes(query))
    }

    return result
})

const isSearching = computed(
    () => searchQuery.value.trim().length > 0 || filterStatus.value !== 'all'
)

const searchStatusText = computed(() => {
    if (!isSearching.value) return ''
    return t('task.details.eventSearchResult', { n: filteredCheckItems.value.length })
})

const toggleFilter = () => {
    const filters: FilterStatus[] = ['all', 'undone', 'done']
    const currentIndex = filters.indexOf(filterStatus.value)
    filterStatus.value = filters[(currentIndex + 1) % filters.length] || 'all'
}

const getFilterIcon = () => {
    switch (filterStatus.value) {
        case 'all':
            return t('task.details.eventFilterAll')
        case 'undone':
            return t('task.details.eventFilterIncomplete')
        case 'done':
            return t('task.details.eventFilterCompleted')
    }
}

const { handleDragStart, handleDragOver, handleDrop, handleDragLeave, handleDragEnd } =
    useEventDragger((dragged, dropped, isUp) => {
        if (!dragged.dataset.eid || !dropped.dataset.eid) return
        resortCheckItems(dragged.dataset.eid, dropped.dataset.eid, isUp)
    })

const createEvent = async (payload: { value: string }) => {
    if (!vo.value) return
    await checkItemHandler.create({ taskId: vo.value.id, name: payload.value })
}

watch(
    () => vo.value?.id,
    () => {
        searchQuery.value = ''
        filterStatus.value = 'all'
    }
)
</script>

<template>
    <nue-div theme="event-list">
        <loading v-if="checkItemsLoading" :placeholder="t('task.details.eventsLoading')" />
        <nue-empty v-else-if="checkItemsError" :description="checkItemsError" image-size="64px">
            <nue-button theme="primary,small" @click="retryCheckItems">{{
                t('common.retry')
            }}</nue-button>
        </nue-empty>
        <template v-else>
            <nue-div
                v-show="checkItems.length >= 10"
                theme="search-header"
                :data-searching="isSearching"
            >
                <nue-text theme="state-filter" @click="toggleFilter">
                    {{ getFilterIcon() }}
                </nue-text>
                <nue-input
                    v-model="searchQuery"
                    :placeholder="t('task.details.eventSearchPlaceholder')"
                    icon="search"
                    theme="small,pure"
                    clearable
                />
                <nue-text>{{ searchStatusText }}</nue-text>
            </nue-div>
            <nue-div
                vertical
                gap="0"
                theme="event-list"
                @dragover="handleDragOver"
                @dragstart="handleDragStart"
                @dragleave="handleDragLeave"
                @dragend="handleDragEnd"
                @drop="handleDrop"
            >
                <event-row
                    v-for="event in filteredCheckItems"
                    data-drag-item="true"
                    :key="event.id"
                    :event="event"
                    :data-eid="event.id"
                    :on-update="(id, v) => checkItemHandler.update({ id, ...v })"
                    :on-delete="checkItemHandler.delete"
                    @to-task="makeCheckItemToTask"
                />
            </nue-div>
            <input-button
                icon="plus-circle"
                :button-text="t('task.details.eventCreate')"
                :placeholder="t('task.details.eventNamePlaceholder')"
                theme="pure,noshape"
                :submit-on-blur="false"
                :on-submit="createEvent"
            />
        </template>
    </nue-div>
</template>

<style scoped>
.nue-div--event-list {
    flex-direction: column;
    gap: 0;
}

.nue-div--search-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 0.25rem;
    opacity: 0.65;
    font-size: var(--nue-text-xs);
    color: var(--nue-primary-color-400);

    &[data-searching='true'],
    &:focus-within,
    &:hover {
        opacity: 1;
        transition: opacity 0.15s linear;
    }

    .nue-input {
        flex: 1;
    }

    .nue-text--state-filter {
        cursor: pointer;

        &:hover {
            text-decoration: underline;
        }
    }
}

.nue-div--filter-section {
    display: flex;
    align-items: center;
    gap: 0.25rem;
    min-width: 80px;
    justify-content: flex-end;
}

.nue-icon.filter-active {
    color: var(--nue-primary-color-600);
}

.nue-div--event-row {
    position: relative;
    overflow: visible;

    &::before {
        content: '';
        position: absolute;
        left: 0;
        width: 100%;
        height: 3px;
        background: linear-gradient(
            90deg,
            var(--nue-primary-color-500),
            var(--nue-primary-color-300)
        );
        visibility: hidden;
        z-index: 10;
        border-radius: 2px;
        box-shadow: 0 0 8px rgba(var(--nue-primary-color-rgb), 0.4);
        transition: opacity 0.15s ease;
    }

    &[data-dod='up']::before {
        visibility: visible;
        top: -2px;
        animation: pulse-up 0.3s ease;
    }

    &[data-dod='down']::before {
        visibility: visible;
        bottom: -2px;
        animation: pulse-down 0.3s ease;
    }
}
</style>

