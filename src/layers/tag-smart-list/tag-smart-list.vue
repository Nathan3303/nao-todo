<template>
    <nue-collapse-item name="tags">
        <template #header="{ collapse, state }">
            <nue-button theme="pure" :icon="state ? 'arrow-right' : 'arrow-down'" @click="collapse">
                <template #default>
                    <nue-div>
                        <nue-text size="12px">标签</nue-text>
                        <nue-text size="12px" color="gray"> {{ tags.length }} </nue-text>
                    </nue-div>
                </template>
            </nue-button>
            <nue-div width="fit-content" gap="8px">
                <nue-tooltip size="small" content="打开标签管理器">
                    <nue-button theme="pure" icon="setting" @click.stop="showTagManageDialog" />
                </nue-tooltip>
                <nue-tooltip size="small" content="创建新标签">
                    <nue-button
                        id="create-tag-btn"
                        theme="pure"
                        icon="plus"
                        @click.stop="showCreateTagDialog"
                    />
                </nue-tooltip>
            </nue-div>
        </template>
        <aside-link
            v-for="tag in tags"
            icon="tag"
            :key="tag.id"
            :route="{ name: 'tasks-tag', params: { tagId: tag.id } }"
        >
            {{ tag.name }}
            <template #append>
                <tag-color-dot :color="tag.color" size="small" />
            </template>
        </aside-link>
    </nue-collapse-item>
    <create-tag-dialog ref="createTagDialogRef" :handler="handleCreateTag" />
    <tag-manager ref="tagManagerRef" />
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useTagStore } from '@/stores'
import { CreateTagDialog, AsideLink, TagColorDot } from '@/components'
import TagManager from '../tag-manager/tag-manager.vue'
import { createTag } from '@/utils/tag-handlers'
import { storeToRefs } from 'pinia'

defineOptions({ name: 'TagSmartList' })

const tagStore = useTagStore()

const { tags } = storeToRefs(tagStore)
const createTagDialogRef = ref<InstanceType<typeof CreateTagDialog>>()
const tagManagerRef = ref<InstanceType<typeof TagManager>>()

const showCreateTagDialog = () => {
    createTagDialogRef.value?.show()
}

const showTagManageDialog = () => {
    tagManagerRef.value?.show()
}

const handleCreateTag = async (payload: any) => {
    return await createTag(payload.name, payload.color)
}
</script>
