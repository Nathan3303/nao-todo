<template>
    <nue-div align="center" width="fit-content" gap="12px">
        <nue-div vertical width="fit-content" gap="4px">
            <nue-input
                theme="small"
                v-model="filterText"
                placeholder="筛选标签"
                icon="filter"
                :debounce-time="360"
            />
        </nue-div>
        <nue-button v-if="isFiltering" theme="small" icon="clear" @click="handleResetFilter">
            重置
        </nue-button>
    </nue-div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { TagFilterBarProps, TagFilterBarEmits } from './types'

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
    emit('filter', {
        name: null
    })
}

watch(
    () => filterText.value,
    (newValue) => {
        const newFilterInfo = { ...props.filterOptions }
        newFilterInfo.name = newValue === '' ? null : newValue
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
