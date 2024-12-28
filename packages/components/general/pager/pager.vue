<template>
    <nue-div :gap="simple ? '8px' : '16px'" align="center" width="fit-content" wrap="nowarp">
        <nue-div align="center" gap="8px" width="fit-content">
            <nue-text v-if="!simple" size="12px">每页条数</nue-text>
            <nue-select v-model="perPage" size="small" @change="handlePerPageChange">
                <nue-select-option v-for="i in [10, 20, 50, 100]" :key="i" :label="i" :value="i" />
            </nue-select>
            <nue-text v-if="simple" size="12px">条/页</nue-text>
        </nue-div>
        <nue-text v-if="simple" size="12px">{{ page }}/{{ totalPages }} 页</nue-text>
        <nue-text v-else size="12px">第 {{ page }} 页，共 {{ totalPages }} 页。</nue-text>
        <nue-div align="center" gap="8px" width="fit-content">
            <nue-button
                v-if="!simple"
                :disabled="prevButtonDisabled"
                icon="arrow-left-more"
                theme="small"
                @click="handleGoToPage(1)"
            />
            <nue-button
                :disabled="prevButtonDisabled"
                icon="arrow-left"
                theme="small"
                @click="handlePrevPage"
            />
            <nue-button
                :disabled="nextButtonDisabled"
                icon="arrow-right"
                theme="small"
                @click="handleNextPage"
            />
            <nue-button
                v-if="!simple"
                :disabled="nextButtonDisabled"
                icon="arrow-right-more"
                theme="small"
                @click="handleGoToPage(totalPages)"
            />
        </nue-div>
    </nue-div>
</template>

<script lang="ts" setup>
import { computed, ref } from 'vue'

const props = defineProps<{
    page: number
    total?: number
    limit?: number
    totalPages: number
    simple?: boolean
}>()
const emit = defineEmits<{
    (event: 'perPageChange', value: number): void
    (event: 'pageChange', value: number): void
}>()

const perPage = ref<number>(props.limit || 20)

const prevButtonDisabled = computed(() => props.page === 1)
const nextButtonDisabled = computed(() => props.page === props.totalPages)

const handlePerPageChange = (value: number) => {
    emit('perPageChange', value as number)
}

const handleNextPage = () => {
    const { page, totalPages } = props
    if (page < totalPages) handleGoToPage(page + 1)
}

const handlePrevPage = () => {
    const { page } = props
    if (page > 1) handleGoToPage(page - 1)
}

const handleGoToPage = (page: number) => {
    const { totalPages } = props
    if (page < 1 || page > totalPages) return
    emit('pageChange', page)
}
</script>
