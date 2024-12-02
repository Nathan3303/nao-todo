<template>
    <nue-collapse-item name="tags">
        <template #header="{ collapse, state }">
            <nue-button theme="pure" :icon="state ? 'arrow-right' : 'arrow-down'" @click="collapse">
                <template #default>
                    <nue-div>
                        <nue-text size="12px">标签</nue-text>
                        <nue-text size="12px" color="gray"> {{ tags.length }}</nue-text>
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

        <template v-if="tags && tags.length">
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
        </template>
        <nue-text v-else class="nue-collapse-item__empty-text" size="11px" color="#a5a5a5">
            以标签的维度展示不同清单的待办任务。
        </nue-text>
    </nue-collapse-item>
    <create-tag-dialog ref="createTagDialogRef" :handler="tagStore.doCreateTag" />
    <tag-manager ref="tagManagerRef" />
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useTagStore } from '@/stores'
import { CreateTagDialog, AsideLink, TagColorDot } from '@nao-todo/components'
import TagManager from '../tag-manager/tag-manager.vue'
import type { Tag } from '@nao-todo/types'

defineOptions({ name: 'TagSmartList' })

const tagStore = useTagStore()

const createTagDialogRef = ref<InstanceType<typeof CreateTagDialog>>()
const tagManagerRef = ref<InstanceType<typeof TagManager>>()

const tags = computed<Tag[]>(() => {
    return tagStore.findTagsFromLocal({}) || []
})

const showCreateTagDialog = () => createTagDialogRef.value?.show()
const showTagManageDialog = () => tagManagerRef.value?.show()
</script>
