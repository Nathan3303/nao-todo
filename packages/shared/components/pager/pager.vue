<script lang="ts" setup>
import { computed, ref, watch } from 'vue'
import type { PagerProps, PagerEmits } from './types'

defineOptions({ name: 'Pager' })
const props = defineProps<PagerProps>()
const emit = defineEmits<PagerEmits>()

const limits = [20, 40, 60, 80]
const perPage = ref<number>(props.limit || 20)

// 归一化总页数：至少为 1，避免 0 / 负数导致的判断异常
const normalizedTotalPages = computed(() => Math.max(props.totalPages || 0, 1))
const prevButtonDisabled = computed(() => props.page <= 1)
const nextButtonDisabled = computed(() => props.page >= normalizedTotalPages.value)
const buttonThemes = computed(() => (props.simple ? 'small,icon' : 'small'))
const wrapperGap = computed(() => (props.simple ? '.5rem' : '1rem'))

// 同步父组件的每页条数
watch(
    () => props.limit,
    (v) => {
        if (typeof v === 'number' && v !== perPage.value) perPage.value = v
    }
)

const handlePerPageChange = (value: unknown) => {
    emit('perPageChange', value as number)
}

const handleNextPage = () => {
    if (props.disabled) return
    if (props.page < normalizedTotalPages.value) handleGoToPage(props.page + 1)
}

const handlePrevPage = () => {
    if (props.disabled) return
    if (props.page > 1) handleGoToPage(props.page - 1)
}

const handleGoToPage = (page: number) => {
    if (props.disabled) return
    if (page < 1 || page > normalizedTotalPages.value) return
    emit('pageChange', page)
}
</script>

<template>
    <nue-div :gap="wrapperGap" align="center" auto-fit>
        <nue-text v-if="!simple" size="var(--nue-text-sm)">
            第 {{ page }} 页，共 {{ normalizedTotalPages }} 页
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
                @click="handleGoToPage(normalizedTotalPages)"
            />
        </nue-div>
        <nue-text v-if="simple" size="var(--nue-text-sm)">
            {{ page }}/{{ normalizedTotalPages }} 页
        </nue-text>
    </nue-div>
</template>
