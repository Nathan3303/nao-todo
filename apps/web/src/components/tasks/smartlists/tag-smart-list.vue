<script lang="ts" setup>
import { NaoSmartList, type NaoSmartListLinkVO } from '@nao-todo/components/'
import { TagColorDot } from '@nao-todo/components'

defineOptions({ name: 'TagSmartList' })
defineProps<{ links: NaoSmartListLinkVO[] }>()
const emit = defineEmits<{
    (e: 'open-tag-manager'): void
    (e: 'open-tag-creator'): void
}>()
</script>

<template>
    <nao-smart-list
        collapse-item-name="tags"
        name="标签"
        manage-btn-tooltip="管理所有标签"
        create-btn-tooltip="创建新的标签"
        empty-text="以标签的维度展示不同清单的待办任务"
        :links="links"
        @manage="() => emit('open-tag-manager')"
        @create="() => emit('open-tag-creator')"
    >
        <template #linkAppend="{ link }">
            <tag-color-dot :color="link.payload?.color" size="small" />
        </template>
    </nao-smart-list>
</template>

