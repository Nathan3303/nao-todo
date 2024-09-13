<template>
    <nue-dialog ref="dialogRef" v-model="visible" title="标签管理">
        <nue-div vertical align="stretch">
            <nue-text size="12px" color="gray">
                "标签管理"能够清楚地展示出所有的标签，方便执行标签的增删改查。
            </nue-text>
            <nue-div align="center" justify="space-between">
                <nue-div width="fit-content" gap="12px">
                    <nue-button
                        theme="small,primary"
                        icon="plus-circle"
                        @click="showCreateTagDialog"
                    >
                        新增
                    </nue-button>
                    <nue-button theme="small" icon="refresh">刷新</nue-button>
                </nue-div>
            </nue-div>
            <nue-div class="tag-manager" vertical align="stretch"> </nue-div>
        </nue-div>
    </nue-dialog>
    <create-tag-dialog ref="createTagDialogRef" :handler="handleCreateTag" />
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { CreateTagDialog } from '@/components'
import { createTag } from '@/utils/tag-handlers'
import { useTagStore } from '@/stores'
import type { Tag, TagFilterOptions } from '@/stores'

defineOptions({ name: 'TagManager' })

const route = useRoute()
const router = useRouter()
const tagStore = useTagStore()

const visible = ref(false)
const loading = ref(false)
const createTagDialogRef = ref<InstanceType<typeof CreateTagDialog>>()
const filterInfo = ref<TagFilterOptions>({})
const tags = ref<Tag[]>([])

const showCreateTagDialog = () => {
    createTagDialogRef.value?.show()
}

const handleCreateTag = async (payload: any) => {
    return await createTag(payload.name, payload.color)
}

const handleShowDialog = () => {
    visible.value = true
}

defineExpose({
    show: handleShowDialog
})
</script>

<style scoped>
@import url('./tag-manager.css');
</style>
