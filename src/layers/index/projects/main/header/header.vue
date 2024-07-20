<template>
    <!-- Project title -->
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
                    @edit="handleEditName"
                    size="24px"
                ></click-to-edit>
            </nue-div>
            <nue-div align="center" justify="end" width="fit-content">
                <tooltip content="归档项目">
                    <nue-button theme="icon-only" icon="archive" @click="handleArchiveProject" />
                </tooltip>
                <tooltip content="项目详情">
                    <nue-button
                        theme="icon-only"
                        icon="warning"
                        @click="showProjectDetailsDialog"
                    />
                </tooltip>
                <tooltip content="删除项目">
                    <nue-button theme="icon-only" icon="delete" @click="handleDeleteProject" />
                </tooltip>
                <nue-avatar
                    src="https://wpimg.wallstcn.com/f778738c-e4f8-4870-b634-56703b4acafe.gif?imageView2/1/w/80/h/80"
                ></nue-avatar>
            </nue-div>
        </nue-div>
        <click-to-edit
            :text="project?.description"
            emptyholder="Click to add description"
            @edit="handleEditDescription"
            size="14px"
            color="gray"
        ></click-to-edit>
    </nue-div>

    <!-- Project navigation -->
    <nue-div v-if="!sph" wrap="nowrap" align="center" height="56px">
        <nue-div class="project-navigations">
            <nue-link theme="btnlike" :route="{ name: 'project-main-overview' }">
                项目总览
            </nue-link>
            <nue-link theme="btnlike" :route="{ name: 'project-main-table' }"> 任务列表 </nue-link>
            <nue-link theme="btnlike" :route="{ name: 'project-main-kanban' }"> 任务看板 </nue-link>
        </nue-div>
    </nue-div>

    <!-- Project info dialog -->
    <project-details-dialog
        ref="projectDetailsDialogRef"
        :project="project"
    ></project-details-dialog>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { NueConfirm, NueMessage } from 'nue-ui'
import type { ProjectsMainHeaderEmits, ProjectsMainHeaderProps } from './types'
import { ClickToEdit, ProjectDetailsDialog, Tooltip } from '@/components'
import { useProjectStore, useViewStore } from '@/stores'
import { storeToRefs } from 'pinia'

const props = defineProps<ProjectsMainHeaderProps>()
const emit = defineEmits<ProjectsMainHeaderEmits>()

const router = useRouter()
const projectStore = useProjectStore()
const viewStore = useViewStore()

const { simpleProjectHeader: sph, projectAsideVisible: pav } = storeToRefs(viewStore)
const projectDetailsDialogRef = ref<InstanceType<typeof ProjectDetailsDialog>>()

const showProjectDetailsDialog = () => {
    projectDetailsDialogRef.value?.show()
}

const handleDeleteProject = () => {
    NueConfirm({
        title: '删除项目',
        content: '确定要删除该项目吗？',
        confirmButtonText: '确定',
        cancelButtonText: '取消'
    }).then(
        async () => {
            const { id } = props.project
            await projectStore.deleteProject(id)
        },
        () => NueMessage.info('操作取消')
    )
}

const handleEditDescription = async (newValue: string) => {
    const { id } = props.project
    await projectStore.updateProject(id, { description: newValue })
}

const handleEditName = async (newValue: string) => {
    const { id } = props.project
    await projectStore.updateProject(id, { title: newValue })
}

const handleHideProjectAside = () => {
    viewStore.toggleProjectAsideVisible()
    // console.log('hideProjectAside');
}

const handleArchiveProject = async () => {
    NueConfirm({
        title: '归档项目',
        content: '确定要归档该项目吗？归档后的项目将无法再进行编辑、删除等操作。',
        confirmButtonText: '确定',
        cancelButtonText: '取消'
    }).then(
        async () => {
            const { id } = props.project
            await projectStore.archiveProject(id)
            router.replace({ name: 'project-dashboard' })
        },
        () => NueMessage.info('操作取消')
    )
}
</script>

<style scoped>
.nue-button--icon-only {
    --icon-weight: 600;
    --icon-size: 16px;
}

.project-navigations {
    width: fit-content;
    gap: 0px;
    padding: 4px;
    background-color: #f4f4f5;
    border-radius: var(--primary-radius);

    .nue-link {
        padding: 4px 12px;
        height: auto;
        color: #66666e;
        border-color: transparent;
        justify-content: center;
        font-size: 14px;

        --hover-background-color: transparent;
        --active-background-color: transparent;

        &.nue-link--actived {
            background-color: white;
            color: #131315;
            box-shadow: var(--secondary-shadow);
        }
    }
}
</style>
