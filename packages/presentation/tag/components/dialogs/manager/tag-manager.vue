<script lang="ts" setup>
import { onMounted, ref } from 'vue'
import {
    TagBoard,
    type DialogInstanceType,
    useDialogWrapper,
    TAG_MANAGER_DIALOG_KEY,
    TAG_UPDATER_DIALOG_KEY,
    RuleHint
} from '@nao-todo/shared'
import useTagManager from './use-tag-manager'
import { TagManagerDialogProps } from './types'

defineOptions({ name: 'TagManagerDialog' })
const props = defineProps<TagManagerDialogProps>()

const dialogRef = ref<DialogInstanceType>()

const { states, filteredTags, loadingTags, openTagCreator, openTagColorUpdater, deleteTag } =
    useTagManager(props)

const { visible, close } = useDialogWrapper(dialogRef)

const open = () => (visible.value = true)

onMounted(() => {
    props.dialogManager.register(TAG_MANAGER_DIALOG_KEY, { open, close })
})
</script>

<template>
    <nue-dialog v-model="visible" ref="dialogRef" theme="large" title="标签管理">
        <nue-container id="TagManager" theme="in-dialog">
            <rule-hint
                icon="priority-2"
                title="关于删除标签"
                content="删除标签后无法恢复，所有标记了该标签的任务都将失去此标签，请谨慎操作。"
                variant="warning"
            />
            <nue-header class="tag-manager-header">
                <nue-input
                    v-model="states.filterInfo.name"
                    icon="search"
                    theme="small"
                    clearable
                    placeholder="搜索标签"
                    style="width: 200px"
                />
                <nue-button icon="plus-circle" theme="small,primary" @click="openTagCreator">
                    新增标签
                </nue-button>
            </nue-header>
            <nue-divider />
            <nue-main>
                <nue-content fill style="overflow: hidden">
                    <tag-board :tags="filteredTags" @recolor="openTagColorUpdater">
                        <template #ops="{ tag }">
                            <nue-tooltip content="修改标签" size="small">
                                <nue-button
                                    icon="edit"
                                    theme="pure,pure-icon"
                                    @click.stop="dialogManager.open(TAG_UPDATER_DIALOG_KEY, tag.id)"
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