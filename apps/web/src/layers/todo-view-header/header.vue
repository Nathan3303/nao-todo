<template>
    <nue-header height="auto" style="flex-direction: column; gap: 16px">
        <nue-div vertical gap="4px">
            <nue-div justify="space-between" wrap="nowrap">
                <nue-div align="center" width="fit-content" gap="8px">
                    <nue-tooltip
                        size="small"
                        :content="`${pav ? '收起' : '展开'}菜单侧栏`"
                        placement="top-start"
                    >
                        <nue-button
                            theme="icon-only"
                            :icon="pav ? 'menu-close' : 'menu-open'"
                            @click="handleHideProjectAside"
                        />
                    </nue-tooltip>
                    <nue-text theme="pointer" size="24px" @click="viewInfo?.handlers?.updateTitle">
                        {{ category === 'tag' ? '#' : '' }}
                        {{ viewInfo?.title || '设置清单标题' }}
                    </nue-text>
                </nue-div>
                <nue-div align="center" justify="end" width="fit-content">
                    <slot name="actions" />
                </nue-div>
            </nue-div>
            <nue-text
                theme="pointer"
                size="14px"
                color="gray"
                v-if="category === 'project'"
                @click="viewInfo?.handlers?.updateDescription"
            >
                {{ viewInfo?.description || '该清单没有设置描述信息，点此设置清单描述' }}
            </nue-text>
        </nue-div>
        <nue-div wrap="nowrap" align="center">
            <nue-div class="project-navigations">
                <slot name="navigations" />
            </nue-div>
        </nue-div>
    </nue-header>
</template>

<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { useViewStore } from '@/stores'
import { useTasksViewStore } from '@/views/index/tasks/stores'
import type { Project, Tag } from '@nao-todo/types'

defineOptions({ name: 'ContentHeader' })
defineProps<{
    title?: string
    subTitle?: string
    project?: Project | null
    tag?: Tag
}>()

const viewStore = useViewStore()
const tasksViewStore = useTasksViewStore()

const { projectAsideVisible: pav } = storeToRefs(viewStore)
const { category, viewInfo } = storeToRefs(tasksViewStore)

const handleHideProjectAside = () => viewStore.toggleProjectAsideVisible()

</script>

<style scoped>
.project-navigations {
    width: fit-content;
    gap: 0;
    padding: 4px;
    background-color: #f4f4f5;
    border-radius: var(--primary-radius);

    &:deep().nue-link {
        padding: 4px 12px;
        height: auto;
        color: #66666e;
        border-color: transparent;
        justify-content: center;
        font-size: 14px;

        --hover-background-color: transparent;
        --active-background-color: transparent;
    }

    &:deep().nue-link--actived {
        background-color: white;
        color: #131315;
        box-shadow: var(--secondary-shadow);
    }
}

</style>
