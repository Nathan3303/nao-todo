<template>
    <nue-header>
        <template v-if="project">
            <nue-div vertical gap="4px">
                <nue-div justify="space-between" wrap="nowrap">
                    <nue-div align="center" width="fit-content" gap="8px">
                        <nue-tooltip :content="`${pav ? '收起' : '展开'}菜单侧栏`">
                            <nue-button
                                theme="icon-only"
                                :icon="pav ? 'menu-close' : 'menu-open'"
                                @click="handleHideProjectAside"
                            ></nue-button>
                        </nue-tooltip>
                        <nue-text theme="pointer" size="24px" @click="renameProject">
                            {{ project?.title }}
                        </nue-text>
                    </nue-div>
                    <nue-div align="center" justify="end" width="fit-content">
                        <nue-tooltip content="归档项目">
                            <nue-button
                                theme="icon-only"
                                icon="archive"
                                @click="handleArchiveProject(project.id)"
                            />
                        </nue-tooltip>
                        <nue-tooltip content="删除项目" align="right">
                            <nue-button theme="icon-only" icon="delete" @click="deleteProject" />
                        </nue-tooltip>
                    </nue-div>
                </nue-div>
                <nue-text theme="pointer" size="14px" color="gray" @click="redescProject">
                    {{ project?.description }}
                </nue-text>
            </nue-div>
        </template>
        <template v-else-if="tag">
            <nue-div vertical gap="4px">
                <nue-div justify="space-between" wrap="nowrap">
                    <nue-div align="center" width="fit-content" gap="8px">
                        <nue-tooltip :content="`${pav ? '收起' : '展开'}菜单侧栏`" align="left">
                            <nue-button
                                theme="icon-only"
                                :icon="pav ? 'menu-close' : 'menu-open'"
                                @click="handleHideProjectAside"
                            ></nue-button>
                        </nue-tooltip>
                        <nue-text>#</nue-text>
                        <click-to-edit
                            :text="tag?.name"
                            size="24px"
                            @edit="handleEditTagName"
                        ></click-to-edit>
                    </nue-div>
                </nue-div>
            </nue-div>
        </template>
        <template v-else>
            <nue-div align="center" justify="space-between" wrap="nowrap">
                <nue-div vertical width="fit-content" gap="4px">
                    <nue-div align="center" width="fit-content" gap="8px" height="36px">
                        <nue-button
                            theme="icon-only"
                            :icon="pav ? 'menu-close' : 'menu-open'"
                            @click="handleHideProjectAside"
                        ></nue-button>
                        <nue-text size="24px"> {{ title }} </nue-text>
                    </nue-div>
                    <nue-text v-if="!sph" size="14px" color="gray">
                        <slot name="subTitle"> {{ subTitle }} </slot>
                    </nue-text>
                </nue-div>
                <nue-div align="center" width="fit-content" gap="8px">
                    <slot name="actions"></slot>
                </nue-div>
            </nue-div>
        </template>
        <nue-div v-if="!sph" wrap="nowrap" align="center">
            <nue-div class="project-navigations">
                <slot name="navigations"> </slot>
            </nue-div>
        </nue-div>
    </nue-header>
</template>

<script setup lang="ts">
import { useViewStore, useProjectStore, useUserStore, useTagStore } from '@/stores'
import { storeToRefs } from 'pinia'
import { ClickToEdit } from '@/components'
import { NueConfirm, NueMessage } from 'nue-ui'
import { useRouter } from 'vue-router'
import { useProjectHandler } from '@/utils'
import type { ContentHeaderProps } from './types'

defineOptions({ name: 'ContentHeader' })
const props = withDefaults(defineProps<ContentHeaderProps>(), {
    title: '名称',
    subTitle: '子标题'
})

const router = useRouter()
const viewStore = useViewStore()
const projectStore = useProjectStore()
const tagStore = useTagStore()
const userStore = useUserStore()
const { handleRenameProject, handleRedescProject, handleDeleteProject, handleArchiveProject } =
    useProjectHandler()

const { projectAsideVisible: pav, simpleProjectHeader: sph } = storeToRefs(viewStore)

const handleHideProjectAside = () => {
    viewStore.toggleProjectAsideVisible()
}

const renameProject = () => {
    if (!props.project) return
    const projectId = props.project?.id
    const projectName = props.project?.title
    handleRenameProject(projectId, projectName)
}

const redescProject = () => {
    if (!props.project) return
    const projectId = props.project?.id
    const projectDescription = props.project?.description
    handleRedescProject(projectId, projectDescription)
}

const deleteProject = async () => {
    const projectId = props.project?.id
    if (!projectId) return
    const deleteResult = await handleDeleteProject(projectId)
    if (deleteResult.code === '20000') {
        router.push('/tasks/all')
    }
}

const handleEditTagName = async (newValue: string) => {
    const userId = userStore.user?.id
    const tagId = props.tag?.id
    if (!tagId || !userId) return
    await tagStore.update(userId, tagId, { name: newValue })
}
</script>

<style scoped>
@import url('./header.css');
</style>
