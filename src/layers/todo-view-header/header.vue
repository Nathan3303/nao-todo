<template>
    <nue-header>
        <template v-if="project">
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
                        <nue-text theme="pointer" size="24px" @click="renameProject">
                            {{ project?.title || '修改清单标题' }}
                        </nue-text>
                    </nue-div>
                    <nue-div align="center" justify="end" width="fit-content">
                        <nue-tooltip size="small" content="删除清单">
                            <nue-button theme="icon-only" icon="delete" @click="deleteProject" />
                        </nue-tooltip>
                        <slot name="actions"></slot>
                    </nue-div>
                </nue-div>
                <nue-text theme="pointer" size="14px" color="gray" @click="redescProject">
                    {{ project?.description || '该清单没有设置描述信息，点此设置清单描述' }}
                </nue-text>
            </nue-div>
        </template>
        <template v-else-if="tag">
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
                    <nue-text>#</nue-text>
                    <nue-text theme="pointer" size="24px" @click="handleRenameTag">
                        {{ tag?.name || '设置标签名称' }}
                    </nue-text>
                </nue-div>
                <nue-div align="center" width="fit-content" gap="8px">
                    <nue-tooltip size="small" content="删除标签">
                        <nue-button
                            theme="icon-only"
                            icon="delete"
                            @click="handleDeleteTag(tag?.id)"
                        />
                    </nue-tooltip>
                    <slot name="actions"></slot>
                </nue-div>
            </nue-div>
        </template>
        <template v-else>
            <nue-div align="center" justify="space-between" wrap="nowrap">
                <nue-div vertical width="fit-content" gap="4px">
                    <nue-div align="center" width="fit-content" gap="8px" height="36px">
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
                        <nue-text size="24px">{{ title }}</nue-text>
                    </nue-div>
                    <nue-text v-if="!sph" size="14px" color="gray">
                        <slot name="subTitle">{{ subTitle }}</slot>
                    </nue-text>
                </nue-div>
                <nue-div align="center" width="fit-content" gap="8px">
                    <slot name="actions" />
                </nue-div>
            </nue-div>
        </template>
        <nue-div v-if="!sph" wrap="nowrap" align="center">
            <nue-div class="project-navigations">
                <slot name="navigations" />
            </nue-div>
        </nue-div>
    </nue-header>
</template>

<script setup lang="ts">
import { useViewStore } from '@/stores'
import { storeToRefs } from 'pinia'
import { useRouter } from 'vue-router'
import {
    renameProjectWithPrompt,
    redescProjectWithPrompt,
    deleteProjectWithConfirm
} from '@/utils/project-handlers'
import { removeTagWithConfirm, renameTagWithPrompt } from '@/utils/tag-handlers'
import type { ContentHeaderProps } from './types'

defineOptions({ name: 'ContentHeader' })
const props = withDefaults(defineProps<ContentHeaderProps>(), {
    title: '名称',
    subTitle: '子标题'
})

const router = useRouter()
const viewStore = useViewStore()

const { projectAsideVisible: pav, simpleProjectHeader: sph } = storeToRefs(viewStore)

const handleHideProjectAside = () => {
    viewStore.toggleProjectAsideVisible()
}

const renameProject = () => {
    if (!props.project) return
    const projectId = props.project?.id
    const projectName = props.project?.title
    renameProjectWithPrompt(projectId, projectName)
}

const redescProject = () => {
    if (!props.project) return
    const projectId = props.project?.id
    const projectDescription = props.project?.description
    redescProjectWithPrompt(projectId, projectDescription)
}

const deleteProject = async () => {
    const projectId = props.project?.id
    if (!projectId) return
    const deleteResult = await deleteProjectWithConfirm(projectId)
    if (deleteResult.code === '20000') {
        router.push('/tasks/all')
    }
}

const handleRenameTag = async () => {
    const { tag } = props
    if (!tag) return
    const tagId = tag.id
    const tagName = tag.name
    return await renameTagWithPrompt(tagId, tagName)
}

const handleDeleteTag = async (tagId: string) => {
    if (!tagId) return
    const removeResult = await removeTagWithConfirm(tagId)
    if (removeResult._id !== tagId) return
    router.push('/tasks/all')
}
</script>

<style scoped>
@import url('./header.css');
</style>
