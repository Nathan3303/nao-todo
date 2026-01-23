<script lang="ts" setup>
import { onMounted, ref } from 'vue'
import { TagBoard } from '@nao-todo/components'
import useTagManager from './use-tag-manager'
import { type DialogInstanceType, useDialogWrapper } from '@/components/ui/dialog-wrapper'
import type { TagManagerEmits, TagManagerProps } from './type'

defineOptions({ name: 'TagManager' })
const props = defineProps<TagManagerProps>()
const emit = defineEmits<TagManagerEmits>()

const dialogRef = ref<DialogInstanceType>()

const { states, filteredTags, deleteTag } = useTagManager(props, emit)
const { visible, close } = useDialogWrapper(dialogRef)

const open = () => {
    visible.value = true
}

onMounted(() => emit('register', open, close))
</script>

<template>
    <nue-dialog v-model="visible" ref="dialogRef" theme="large">
        <template #header>
            <nue-text>标签管理</nue-text>
            <nue-button @click="close" icon="clear" theme="icon,ghost,small" />
        </template>
        <nue-container id="TagManager" theme="in-dialog">
            <nue-header>
                <nue-div align="center" width="fit-content">
                    <nue-input
                        v-model="states.filterInfo.name"
                        icon="filter"
                        theme="small"
                        clearable
                        placeholder="筛选标签"
                    />
                </nue-div>
                <nue-div gap="12px" width="fit-content" style="margin-left: auto">
                    <nue-button icon="plus-circle" theme="small,primary" @click="tagCreatorOpener">
                        新增
                    </nue-button>
                </nue-div>
            </nue-header>
            <nue-divider />
            <nue-main>
                <nue-content fill style="overflow: hidden">
                    <tag-board
                        :tags="filteredTags"
                        @delete="deleteTag"
                        @recolor="tagColorUpdaterOpener"
                    />
                </nue-content>
            </nue-main>
        </nue-container>
    </nue-dialog>
</template>

<style scoped>
.tag-manager {
    aspect-ratio: 16 / 9;
    min-height: 520px;
}

.tag-navigations {
    width: fit-content;
    gap: 0;
    padding: 4px;
    background-color: #f4f4f5;
    border-radius: var(--primary-radius);
}

.tag-navigations:deep(.nue-link) {
    padding: 4px 12px;
    height: auto;
    color: #66666e;
    border-color: transparent;
    justify-content: center;
    font-size: 14px;

    --hover-background-color: transparent;
    --active-background-color: transparent;
}

.tag-navigations:deep(.nue-link--actived) {
    background-color: white;
    color: #131315;
    box-shadow: var(--secondary-shadow);
}
</style>

