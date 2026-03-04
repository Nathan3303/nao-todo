<script lang="ts" setup>
import { computed, ref } from 'vue'
import type { PagerProps, PagerEmits } from './types'

defineOptions({ name: 'Pager' })
const props = defineProps<PagerProps>()
const emit = defineEmits<PagerEmits>()

const limits = [20, 40, 60, 80]
const perPage = ref<number>(props.limit || 20)

const prevButtonDisabled = computed(() => props.page === 1)
const nextButtonDisabled = computed(() => props.page === props.totalPages)
const buttonThemes = computed(() => (props.simple ? 'small,icon' : 'small'))
const wrapperGap = computed(() => (props.simple ? '.5rem' : '1rem'))

const handlePerPageChange = (value: unknown) => {
    emit('perPageChange', value as number)
}

const handleNextPage = () => {
    const { page, totalPages, disabled } = props
    if (disabled) return
    if (page < totalPages) handleGoToPage(page + 1)
}

const handlePrevPage = () => {
    const { page, disabled } = props
    if (disabled) return
    if (page > 1) handleGoToPage(page - 1)
}

const handleGoToPage = (page: number) => {
    const { totalPages, disabled } = props
    if (disabled) return
    if (page < 1 || page > totalPages) return
    emit('pageChange', page)
}
</script>

<template>
    <nue-div :gap="wrapperGap" align="center" auto-fit>
        <nue-text v-if="!simple" size="var(--nue-text-sm)">
            第 {{ page }} 页，共 {{ totalPages }} 页
        </nue-text>
        <nue-select
            v-model="perPage"
            size="small"
            @change="handlePerPageChange"
            :disabled="disabled"
        >
            <nue-select-option v-for="i in limits" :key="i" :label="i + ' 条每页'" :value="i" />
        </nue-select>
        <nue-div align="center" gap=".5rem">
            <nue-button
                v-if="!simple"
                :disabled="prevButtonDisabled || disabled"
                icon="arrow-left-more"
                :theme="buttonThemes"
                @click="handleGoToPage(1)"
            />
            <nue-button
                :disabled="prevButtonDisabled || disabled"
                icon="arrow-left"
                :theme="buttonThemes"
                @click="handlePrevPage"
            />
            <nue-button
                :disabled="nextButtonDisabled || disabled"
                icon="arrow-right"
                :theme="buttonThemes"
                @click="handleNextPage"
            />
            <nue-button
                v-if="!simple"
                :disabled="nextButtonDisabled || disabled"
                icon="arrow-right-more"
                :theme="buttonThemes"
                @click="handleGoToPage(totalPages)"
            />
        </nue-div>
        <nue-text v-if="simple" size="var(--nue-text-sm)">{{ page }}/{{ totalPages }} 页</nue-text>
    </nue-div>
</template>
