<template>
    <nue-div align="center" gap="8px" width="fit-content">
        <nue-div vertical width="fit-content" gap="4px">
            <nue-input
                :theme="['small', isFiltering ? 'actived' : '']"
                v-model="filterText"
                placeholder="筛选任务"
                icon="filter"
                :debounce-time="360"
                clearable
            />
        </nue-div>
        <!--        <nue-button size="small" :icon="archivedOnlyIconName" @click="handleIsArchived">-->
        <!--            仅已归档-->
        <!--        </nue-button>-->
        <!--        <nue-button size="small" :icon="deletedOnlyIconName" @click="handleIsDeleted">-->
        <!--            仅已删除-->
        <!--        </nue-button>-->
        <!--        <nue-button v-if="isFiltering" theme="small" icon="clear" @click="handleResetFilter">-->
        <!--            重置-->
        <!--        </nue-button>-->
    </nue-div>
</template>

<script setup lang="ts">
import { useProjectFilterBar } from './use-filter-bar'
import type { ProjectFilterBarProps, ProjectFilterBarEmits } from './types'

defineOptions({ name: 'TodoFilterBar' })
const props = defineProps<ProjectFilterBarProps>()
const emit = defineEmits<ProjectFilterBarEmits>()

const { filterText, isFiltering } = useProjectFilterBar(props, emit)
</script>

<style scoped>
.nue-input--actived {
    --border-color: orange;
    box-shadow: var(--secondary-shadow);
}

.nue-input--small {
    width: 200px;
    font-size: var(--text-xs);
}
</style>
