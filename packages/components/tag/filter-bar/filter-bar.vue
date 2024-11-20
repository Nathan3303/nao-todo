<template>
    <nue-div align="center" gap="12px" width="fit-content">
        <nue-div gap="4px" vertical width="fit-content">
            <nue-input
                v-model="filterText"
                :debounce-time="360"
                icon="filter"
                placeholder="筛选标签"
                theme="small"
            />
        </nue-div>
        <nue-button v-if="isFiltering" icon="clear" theme="small" @click="handleResetFilter">
            重置
        </nue-button>
    </nue-div>
</template>

<script lang="ts" setup>
import { computed, ref, watch } from 'vue'
import type { TagFilterBarEmits, TagFilterBarProps } from './types'

defineOptions({ name: 'TagFilterBar' })
const props = defineProps<TagFilterBarProps>()
const emit = defineEmits<TagFilterBarEmits>()

const filterText = ref<string>(props.filterOptions.name || '')

const isFiltering = computed(() => {
    const { name } = props.filterOptions
    return name
})

const handleResetFilter = () => {
    filterText.value = ''
    emit('filter', {})
}

watch(
    () => filterText.value,
    (newValue) => {
        const newFilterInfo = { ...props.filterOptions }
        // newFilterInfo.name = newValue === '' ? null : newValue
        if (newValue === '') {
            delete newFilterInfo.name
        } else {
            newFilterInfo.name = newValue
        }
        emit('filter', newFilterInfo)

    }
)
</script>

<style scoped>
.nue-input--actived {
    border-color: orange;
    box-shadow: var(--secondary-shadow);
}

.nue-input--small {
    width: 200px;
    font-size: var(--text-xs);
}
</style>
