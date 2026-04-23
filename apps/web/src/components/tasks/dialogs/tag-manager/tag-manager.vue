<script lang="ts" setup>
import { onMounted, ref, inject, computed, reactive } from 'vue'
import { TagBoard, TagColorDot } from '@nao-todo/components'
import { type DialogInstanceType, useDialogWrapper } from '@nao-todo/components'
import type { TagManagerEmits, TagManagerProps } from './type'
import { DIALOG_MANAGER_CONTEXT_KEY } from '@/infrastructure/constants/tasks-view'
import type { DialogManagerContext } from '@/layouts/tasks/dialogs/types'
import { NueConfirm, NueMessage } from 'nue-ui'
import { unwrapError } from '@nao-todo/infrastructure/utils'

defineOptions({ name: 'TagManager' })
const props = defineProps<TagManagerProps>()
const emit = defineEmits<TagManagerEmits>()

const dialogRef = ref<DialogInstanceType>()
const loadingTags = ref<Map<string, boolean>>(new Map())

const dialogManagerContext = inject<DialogManagerContext>(DIALOG_MANAGER_CONTEXT_KEY)!

const states = reactive({ filterInfo: { name: '' } })

const filteredTags = computed(() => {
    return props.tags.filter((tag) => {
        if (states.filterInfo.name === '') return true
        return tag.name.includes(states.filterInfo.name)
    })
})

const { visible, close } = useDialogWrapper(dialogRef)

const open = () => (visible.value = true)

const handleDeleteTag = (tagId: string) => {
    loadingTags.value.set(tagId, true)
    NueConfirm({
        title: '确认删除标签吗？',
        content: '删除后无法恢复，所有标记了该标签的任务都将失去此标签。是否继续？',
        confirmButtonText: '确认删除',
        cancelButtonText: '取消',
        onConfirm: async () => {
            const err = await dialogManagerContext.tagUseCase.delete(tagId)
            if (err !== null) {
                NueMessage.error(unwrapError(err))
                return
            }
            NueMessage.success('标签删除成功')
        }
    }).finally(() => loadingTags.value.delete(tagId))
}

onMounted(() => emit('register', open, close))
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
                    <nue-button icon="plus-circle" theme="small,primary" @click="tagCreatorOpener">
                        新增标签
                    </nue-button>
                </nue-div>
            </nue-header>
            <nue-divider />
            <nue-main>
                <nue-content fill style="overflow: hidden">
                    <tag-board :tags="filteredTags" @recolor="tagColorUpdaterOpener">
                        <template #ops="{ tag }">
                            <nue-tooltip content="修改标签提示色" size="small">
                                <tag-color-dot
                                    :color="tag.color"
                                    @click="tagColorUpdaterOpener(tag.id)"
                                />
                            </nue-tooltip>
                            <nue-tooltip content="删除标签" size="small">
                                <nue-button
                                    icon="delete"
                                    theme="pure,pure-icon"
                                    :loading="loadingTags.get(tag.id)"
                                    @click.stop="handleDeleteTag(tag.id)"
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
        border: none;
        height: auto;
        justify-content: space-between;
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
    padding: var(--nue-padding-df);
    max-width: 12rem;

    > .nue-tooltip__text {
        font-size: var(--nue-text-sm);
        line-height: 1.5;
        color: var(--nue-error-color-50);
    }
}
</style>

