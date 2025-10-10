<template>
    <nue-div align="center" width="fit-content">
        <nue-input
            v-model="filterInfo.name"
            icon="filter"
            theme="small"
            clearable
            placeholder="筛选清单"
        />
        <nue-checkbox v-model="onlyDeleted" theme="small">只看已删除</nue-checkbox>
    </nue-div>
</template>

<script setup lang="ts">
import useProjectManagerStore from './use-project-manager-store'
import { storeToRefs } from 'pinia'
import { computed } from 'vue'

defineOptions({ name: 'ProjectManagerFilterBar' })

const projectManagerStore = useProjectManagerStore()

const { filterInfo } = storeToRefs(projectManagerStore)

const onlyDeleted = computed({
    get: () => !!filterInfo.value.isDeleted,
    set: (val: boolean) => (filterInfo.value.isDeleted = val || null)
})
</script>

<style scoped></style>
