<template>
    <nue-div align="center" width="fit-content">
        <nue-div align="center" width="fit-content" gap="8px">
            <nue-text size="12px">每页条数</nue-text>
            <nue-select size="small" v-model="perpage" @change="handlePerPageChange">
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
                @click="handleGoToPage(totalPages)"
            ></nue-button>
        </nue-div>
    </nue-div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import type { PagerEmits, PagerProps } from './types'

const props = defineProps<PagerProps>()
const emit = defineEmits<PagerEmits>()

const perpage = ref<number>(props.limit || 20)

const prevButtonDisabled = computed(() => props.page === 1)
const nextButtonDisabled = computed(() => props.page === props.totalPages)

function handlePerPageChange(value: number) {
    emit('perpageChange', value as number)
}

function handleNextPage() {
    const { page, totalPages } = props
    if (page < totalPages) {
        handleGoToPage(page + 1)
    }
}

function handlePrevPage() {
    const { page } = props
    if (page > 1) {
        handleGoToPage(page - 1)
    }
}

function handleGoToPage(page: number) {
    const { totalPages } = props
    if (page < 1 || page > totalPages) {
        return
    }
    emit('pageChange', page)
}
</script>

<style scoped></style>
