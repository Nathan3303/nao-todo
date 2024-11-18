<template>
    <nue-div align="center" width="fit-content">
        <nue-div align="center" width="fit-content" gap="8px">
            <nue-text size="12px">每页条数</nue-text>
            <nue-select size="small" v-model="perPage" @change="handlePerPageChange">
                <nue-select-option v-for="i in 5" :key="i" :label="`${i * 10}`" :value="i * 10" />
            </nue-select>
        </nue-div>
        <nue-text size="12px"> 第 {{ page }} 页，共 {{ totalPages }} 页。</nue-text>
        <nue-div width="fit-content" gap="8px" align="center">
            <nue-button
                theme="small"
                icon="arrow-left-more"
                :disabled="prevButtonDisabled"
                @click="handleGoToPage(1)"
            />
            <nue-button
                theme="small"
                icon="arrow-left"
                :disabled="prevButtonDisabled"
                @click="handlePrevPage"
            />
            <nue-button
                theme="small"
                icon="arrow-right"
                :disabled="nextButtonDisabled"
                @click="handleNextPage"
            />
            <nue-button
                theme="small"
                icon="arrow-right-more"
                :disabled="nextButtonDisabled"
                @click="handleGoToPage(totalPages)"
            />
        </nue-div>
    </nue-div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'

const props = defineProps<{
    page: number
    total?: number
    limit?: number
    totalPages: number
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
