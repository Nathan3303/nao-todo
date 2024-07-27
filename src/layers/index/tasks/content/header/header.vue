<template>
    <nue-header>
        <template v-if="project">
            <nue-div vertical gap="4px">
                <nue-div justify="space-between" wrap="nowrap">
                    <nue-div align="center" width="fit-content" gap="8px">
                        <tooltip :content="`${pav ? '收起' : '展开'}菜单侧栏`" align="left">
                            <nue-button
                                theme="icon-only"
                                :icon="pav ? 'menu-close' : 'menu-open'"
                                @click="handleHideProjectAside"
                            ></nue-button>
                        </tooltip>
                        <click-to-edit
                            :text="project?.title"
                            @edit="handleEditProjectName"
                            size="24px"
                        ></click-to-edit>
                    </nue-div>
                    <nue-div align="center" justify="end" width="fit-content">
                        <tooltip content="归档项目">
                            <nue-button
                                theme="icon-only"
                                icon="archive"
                                @click="handleArchiveProject"
                            />
                        </tooltip>
                        <!-- <tooltip content="项目详情">
                            <nue-button
                                theme="icon-only"
                                icon="warning"
                                @click="showProjectDetailsDialog"
                            />
                        </tooltip> -->
                        <tooltip content="删除项目">
                            <nue-button
                                theme="icon-only"
                                icon="delete"
                                @click="handleDeleteProject"
                            />
                        </tooltip>
                        <nue-avatar
                            src="https://wpimg.wallstcn.com/f778738c-e4f8-4870-b634-56703b4acafe.gif?imageView2/1/w/80/h/80"
                        ></nue-avatar>
                    </nue-div>
                </nue-div>
                <click-to-edit
                    v-if="!sph"
                    :text="project?.description"
                    emptyholder="点击添加清单描述"
                    @edit="handleEditDescription"
                    size="14px"
                    color="gray"
                ></click-to-edit>
            </nue-div>
        </template>
        <template v-else>
            <nue-div align="center" justify="space-between" wrap="nowrap">
                <nue-div vertical width="fit-content" gap="4px" flex>
                    <nue-div align="center" width="fit-content" gap="8px">
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
                <nue-div align="center" justify="end" width="fit-content" gap="8px">
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
import { useViewStore, useProjectStore, useUserStore } from '@/stores'
import { storeToRefs } from 'pinia'
import { ClickToEdit, Tooltip } from '@/components'
import { NueConfirm, NueMessage } from 'nue-ui'
import { useRouter } from 'vue-router'
import type { ContentHeaderProps } from './types'
import type { RouteLocationRaw } from 'vue-router'

defineOptions({ name: 'ContentHeader' })
const props = withDefaults(defineProps<ContentHeaderProps>(), {
    title: '名称',
    subTitle: '子标题'
})

const router = useRouter()
const viewStore = useViewStore()
const projectStore = useProjectStore()
const userStore = useUserStore()

const { projectAsideVisible: pav, simpleProjectHeader: sph } = storeToRefs(viewStore)

const handleHideProjectAside = () => {
    viewStore.toggleProjectAsideVisible()
}

const handleEditProjectName = async (newValue: string) => {
    const projectId = props.project?.id
    if (!projectId) return
    await projectStore.updateProject(projectId, { title: newValue })
}

const handleArchiveProject = async () => {
    NueConfirm({
        title: '归档项目',
        content: '确定要归档该项目吗？归档后的项目将无法再进行编辑、删除等操作。',
        confirmButtonText: '确定',
        cancelButtonText: '取消'
    }).then(
        async () => {
            const projectId = props.project?.id
            if (!projectId) return
            const res = await projectStore.archiveProject(projectId)
            if (res.code !== '20000') return
            const topProject = projectStore.projects[0]
            let route: RouteLocationRaw = { name: 'tasks-all' }
            if (topProject) {
                route = { name: 'tasks-project', params: { projectId: topProject.id } }
            }
            router.replace(route)
        },
        () => NueMessage.info('操作取消')
    )
}

const handleDeleteProject = () => {
    NueConfirm({
        title: '删除项目',
        content: '确定要删除该项目吗？',
        confirmButtonText: '确定',
        cancelButtonText: '取消'
    }).then(
        async () => {
            const projectId = props.project?.id
            if (!projectId) return
            await projectStore.deleteProject(projectId)
        },
        () => NueMessage.info('操作取消')
    )
}

const handleEditDescription = async (newValue: string) => {
    const projectId = props.project?.id
    if (!projectId) return
    await projectStore.updateProject(projectId, { description: newValue })
}
</script>

<style scoped>
@import url('./header.css');
</style>
