<script lang="ts" setup>
import { NaoSmartList, type NaoSmartListLinkVO } from '@/components/ui'

defineOptions({ name: 'ProjectSmartList' })
defineProps<{ links: NaoSmartListLinkVO[] }>()
const emit = defineEmits<{
    (e: 'open-project-manager'): void
    (e: 'open-project-creator'): void
}>()
</script>

<template>
    <nao-smart-list
        collapse-item-name="projects"
        name="清单"
        manage-btn-tooltip="管理所有清单"
        create-btn-tooltip="创建新的清单"
        empty-text="用清单来分类收集、组织和管理你的待办任务"
        :links="links"
        @manage="() => emit('open-project-manager')"
        @create="() => emit('open-project-creator')"
    />
</template>

