<template>
    <!-- Project title -->
    <nue-div justify="space-between" wrap="nowrap">
        <nue-div vertical gap="4px" flex>
            <nue-div align="center" width="fit-content" gap="8px">
                <nue-button
                    theme="icon-only"
                    icon="more2"
                    @click="handleHideProjectAside"
                    style="--icon-size: 22px"
                ></nue-button>
                <click-to-edit
                    :text="project?.title"
                    @edit="handleEditName"
                    size="26px"
                    weight="bold"
                ></click-to-edit>
            </nue-div>
            <click-to-edit
                :text="project?.description"
                emptyholder="Click to add description"
                @edit="handleEditDescription"
                size="14px"
                color="gray"
            ></click-to-edit>
        </nue-div>
        <nue-div align="center" justify="end" width="fit-content" gap="8px">
            <nue-button theme="icon-only" icon="warning" @click="showProjectDetailsDialog">
            </nue-button>
            <nue-button
                theme="icon-only"
                icon="delete"
                @click="handleDeleteProject"
                style="color: red"
            >
            </nue-button>
            <nue-div align="center" gap="8px" width="fit-content" style="margin-left: 4px">
                <!-- <nue-text size="12px">创建者</nue-text> -->
                <nue-avatar
                    src="https://wpimg.wallstcn.com/f778738c-e4f8-4870-b634-56703b4acafe.gif?imageView2/1/w/80/h/80"
                ></nue-avatar>
            </nue-div>
        </nue-div>
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
import { NueConfirm, NueMessage } from 'nue-ui'
import type { ProjectsMainHeaderEmits, ProjectsMainHeaderProps } from './types'
import { ClickToEdit, ProjectDetailsDialog } from '@/components'
import { useProjectStore, useViewStore } from '@/stores'
import { storeToRefs } from 'pinia'

const props = defineProps<ProjectsMainHeaderProps>()
const emit = defineEmits<ProjectsMainHeaderEmits>()

const projectStore = useProjectStore()
const viewStore = useViewStore()

const { simpleProjectHeader: sph } = storeToRefs(viewStore)
const projectDetailsDialogRef = ref<InstanceType<typeof ProjectDetailsDialog>>()

const showProjectDetailsDialog = () => {
    projectDetailsDialogRef.value?.show()
}

const handleDeleteProject = () => {
    NueConfirm({
        title: '删除项目',
        content: '确定要删除该项目吗？'
    }).then(
        async () => {
            const { id } = props.project
            await projectStore.deleteProject(id)
        },
        () => NueMessage.info('Operation canceled')
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
</script>

<style scoped>
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
