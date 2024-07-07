<template>
    <nue-footer style="padding: 4px; border: none; height: fit-content">
        <nue-div align="center" justify="space-between">
            <nue-text size="12px" color="gray" flex>
                {{ countInfo?.count }} of {{ countInfo?.total }} row(s)
            </nue-text>
            <nue-div align="center" width="fit-content" gap="8px">
                <nue-text size="12px">Rows per page</nue-text>
                <nue-select size="small" v-model="perpage" @change="handlePerPageChange">
                    <nue-select-option label="10" :value="10"></nue-select-option>
                    <nue-select-option label="10" :value="10"></nue-select-option>
                    <nue-select-option label="20" :value="20"></nue-select-option>
                    <nue-select-option label="30" :value="30"></nue-select-option>
                    <nue-select-option label="40" :value="40"></nue-select-option>
                    <nue-select-option label="50" :value="50"></nue-select-option>
                </nue-select>
            </nue-div>
            <nue-text size="12px">
                Page {{ pageInfo?.page }} of {{ pageInfo?.totalPages }}
            </nue-text>
            <nue-div width="fit-content" gap="8px" align="center">
                <nue-button
                    theme="small"
                    icon="arrow-left-more"
                    :disabled="prevButtonDisabled"
                    @click="handleGoToPage(1)"
                ></nue-button>
                <nue-button
                    theme="small"
                    icon="arrow-left"
                    :disabled="prevButtonDisabled"
                    @click="handlePrevPage"
                ></nue-button>
                <nue-button
                    theme="small"
                    icon="arrow-right"
                    :disabled="nextButtonDisabled"
                    @click="handleNextPage"
                ></nue-button>
                <nue-button
                    theme="small"
                    icon="arrow-right-more"
                    :disabled="nextButtonDisabled"
                    @click="handleGoToPage(props.pageInfo.totalPages)"
                ></nue-button>
            </nue-div>
        </nue-div>
    </nue-footer>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'

const props = defineProps<{
    total: number
    pageInfo: { page: number; limit: number; totalPages: number }
    countInfo: { count: number; total: number }
}>()
const emit = defineEmits<{
    (event: 'perpageChange', value: number): void
    (event: 'pageChange', value: number): void
}>()

const perpage = ref(10)

const firstButtonDisabled = computed(() => props.pageInfo.page === 1)
const prevButtonDisabled = computed(() => props.pageInfo.page === 1)
const nextButtonDisabled = computed(() => props.pageInfo.page === props.pageInfo.totalPages)
const lastButtonDisabled = computed(() => props.pageInfo.page === props.pageInfo.totalPages)

function handlePerPageChange(value: number) {
    emit('perpageChange', value as number)
}

function handleNextPage() {
    if (props.pageInfo.page < props.pageInfo.totalPages) {
        handleGoToPage(props.pageInfo.page + 1)
    }
}

function handlePrevPage() {
    if (props.pageInfo.page > 1) {
        handleGoToPage(props.pageInfo.page - 1)
    }
}

function handleGoToPage(page: number) {
    if (page < 1 || page > props.pageInfo.totalPages) {
        return
    }
    emit('pageChange', page)
}
</script>
