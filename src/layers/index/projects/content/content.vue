<template>
    <nue-container class="project-content">
        <nue-header class="project-content__header">
            <nue-div align="center" height="36px" wrap="nowrap" style="overflow: auto">
                <nue-div class="project-content__header__title" gap="4px">
                    <nue-button
                        theme="icon-only"
                        :icon="pav ? 'menu-close' : 'menu-open'"
                        @click="viewStore.toggleProjectAsideVisible()"
                    />
                    <nue-text size="23px"> {{ title }} </nue-text>
                </nue-div>
                <nue-div class="project-content__header__actions">
                    <slot name="actions"></slot>
                    <nue-button theme="icon-only" icon="setting" />
                </nue-div>
            </nue-div>
            <nue-text size="14px" color="gray" v-if="$slots.subTitle || subTitle">
                <slot name="subTitle"> {{ subTitle }} </slot>
            </nue-text>
        </nue-header>
        <nue-container class="project-content__main">
            <nue-header class="project-content__main__header">
                <project-filter-bar :filter-info="filterInfo" />
                <nue-button theme="primary,small" icon="plus" @click="handleCreateProject">
                    创建清单
                </nue-button>
            </nue-header>
            <project-board :projects="projects" allow-route />
        </nue-container>
    </nue-container>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useViewStore, useProjectStore, useUserStore } from '@/stores'
import { storeToRefs } from 'pinia'
import { ProjectFilterBar, ProjectBoard } from '@/components'
import type { ProjectContentProps } from './types'

defineOptions({ name: 'ProjectContent' })
const props = withDefaults(defineProps<ProjectContentProps>(), {
    title: '未知板块'
})

const viewStore = useViewStore()
const projectStore = useProjectStore()
const userStore = useUserStore()

const { projectAsideVisible: pav } = storeToRefs(viewStore)
const { filterInfo, projects } = storeToRefs(projectStore)

const handleCreateProject = () => {
    const createProjectBtn = document.querySelector(
        '#create-project-btn'
    ) as HTMLButtonElement | null
    createProjectBtn?.click()
}

const getProjects = async () => {
    const userId = userStore.user!.id
    const { filterInfo } = props
    console.log(filterInfo)
    await projectStore.init(userId, { ...filterInfo })
}

await getProjects()
</script>

<style scoped>
@import url('./content.css');
</style>
