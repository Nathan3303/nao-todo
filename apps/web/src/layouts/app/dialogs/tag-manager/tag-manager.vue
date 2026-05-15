<script lang="ts" setup>
import { onMounted, ref } from 'vue'
import { TagBoard, TagColorDot } from '@nao-todo/components'
import { type DialogInstanceType, useDialogWrapper } from '@nao-todo/components'
import useTagManager from './use-tag-manager'
import { TAG_MANAGER_DIALOG_KEY } from '@/infrastructure/constants/dialog-keys'

defineOptions({ name: 'TagManager' })

const dialogRef = ref<DialogInstanceType>()

const {
    states,
    filteredTags,
    loadingTags,
    dialogManager,
    openTagCreator,
    openTagColorUpdater,
    deleteTag
} = useTagManager()

const { visible, close } = useDialogWrapper(dialogRef)

const open = () => (visible.value = true)

onMounted(() => {
    dialogManager.register(TAG_MANAGER_DIALOG_KEY, { open, close })
})
</script>

<template>
    <nue-dialog v-model="visible" ref="dialogRef" theme="fullscreen" title="标签管理">
        <nue-container id="TagManager" theme="in-dialog">
            <nue-header class="tag-manager-header">
                <nue-div align="center" gap="0.75rem">
                    <nue-input
                        v-model="states.filterInfo.name"
                        icon="search"
                        theme="small"
                        clearable
                        placeholder="搜索标签"
                        style="width: 200px"
                    />
                </nue-div>
                <nue-div align="center" gap="0.75rem">
                    <nue-tooltip
                        size="small"
                        theme="danger"
                        content="删除标签后无法恢复，所有标记了该标签的任务都将失去此标签。请谨慎操作。"
                        placement="bottom-center"
                    >
                        <nue-div align="center" gap="0.25rem" class="danger-trigger">
                            <nue-icon name="warning" size="14px" />
                            <nue-text size="12px">删除功能重要提醒</nue-text>
                        </nue-div>
                    </nue-tooltip>
                    <nue-divider vertical />
                    <nue-button icon="plus-circle" theme="small,primary" @click="openTagCreator">
                        新增标签
                    </nue-button>
                </nue-div>
            </nue-header>
            <nue-divider />
            <nue-main>
                <nue-content fill style="overflow: hidden">
                    <tag-board :tags="filteredTags" @recolor="openTagColorUpdater">
                        <template #ops="{ tag }">
                            <nue-tooltip content="修改标签提示色" size="small">
                                <tag-color-dot
                                    :color="tag.color"
                                    @click="openTagColorUpdater(tag.id)"
                                />
                            </nue-tooltip>
                            <nue-tooltip content="删除标签" size="small">
                                <nue-button
                                    icon="delete"
                                    theme="pure,pure-icon"
                                    :loading="loadingTags.get(tag.id)"
                                    @click.stop="deleteTag(tag.id)"
                                />
                            </nue-tooltip>
                        </template>
                    </tag-board>
                </nue-content>
            </nue-main>
        </nue-container>
    </nue-dialog>
</template>

<style scoped>
#TagManager {
    .tag-manager-header {
        height: auto;
        justify-content: space-between;
        flex-wrap: wrap;
    }

    .danger-trigger {
        cursor: default;
        color: var(--nue-error-color-60);
    }
}
</style>

<style>
.nue-tooltip.nue-tooltip--danger {
    background-color: var(--nue-error-color-10);
    padding: var(--nue-padding-sm);
    max-width: 14rem;

    > .nue-tooltip__text {
        font-size: var(--nue-text-sm);
        color: var(--nue-error-color-50);
    }
}
</style>
