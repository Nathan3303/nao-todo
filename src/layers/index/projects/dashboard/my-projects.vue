<template>
    <nue-container class="my-projects">
        <nue-header class="my-projects__header">
            <nue-div align="center" height="36px" wrap="nowrap" style="overflow: auto">
                <nue-div class="my-projects__header__title" gap="4px">
                    <nue-button
                        theme="icon-only"
                        :icon="pav ? 'menu-close' : 'menu-open'"
                        @click="viewStore.toggleProjectAsideVisible()"
                    ></nue-button>
                    <nue-text size="23px"> 我的清单 </nue-text>
                </nue-div>
                <nue-div class="my-projects__header__actions">
                    <nue-button theme="icon-only" icon="setting"></nue-button>
                </nue-div>
            </nue-div>
            <nue-text size="14px" color="gray">
                “我的清单”
                板块是用来管理你创建的项目清单。在这个板块中，你可以查看、编辑、删除你的项目。
            </nue-text>
        </nue-header>
        <nue-container class="my-projects__main">
            <nue-header class="my-projects__main__header">
                <project-filter-bar :filter-info="filterInfo"></project-filter-bar>
                <nue-button theme="primary,small" icon="plus" @click="handleCreateProject">
                    创建清单
                </nue-button>
            </nue-header>
            <project-board :projects="projects" allow-route></project-board>
        </nue-container>
    </nue-container>
</template>

<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { useProjectStore, useViewStore, useUserStore } from '@/stores'
import { ProjectBoard, ProjectFilterBar } from '@/components'

defineOptions({ name: 'MyProjects' })

const projectStore = useProjectStore()
const viewStore = useViewStore()
const userStore = useUserStore()

// await projectStore.init(userStore.user!.id, { isDeleted: false })

const { filterInfo, projects } = storeToRefs(projectStore)
const { projectAsideVisible: pav } = storeToRefs(viewStore)

const handleCreateProject = () => {
    const createProjectBtn = document.querySelector(
        '#create-project-btn'
    ) as HTMLButtonElement | null
    createProjectBtn?.click()
}
</script>

<style scoped>
.my-projects {
    gap: 24px;

    .my-projects__header {
        padding: 0px;
        border-bottom: none;
        height: auto;
        flex-direction: column;
        align-items: stretch;
        gap: 4px;

        .my-projects__header__title {
            flex: auto;
            overflow: hidden;

            .nue-text {
                text-overflow: ellipsis;
                white-space: nowrap;
                overflow: hidden;
            }
        }

        .my-projects__header__actions {
            width: fit-content;
            margin-left: auto;
            align-items: center;
            /* flex: auto; */
            flex-shrink: 0;
        }
    }

    .my-projects__main {
        padding: 0px;
        gap: 16px;

        .my-projects__main__header {
            padding: 0px;
            height: auto;
            border-bottom: none;
            justify-content: space-between;
        }
    }
}
</style>
