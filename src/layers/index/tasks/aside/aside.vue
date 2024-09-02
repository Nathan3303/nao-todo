<template>
    <nue-container class="tasks-view-aside">
        <nue-header>
            <aside-link icon="more2" :route="{ name: 'tasks-all' }"> 所有 </aside-link>
            <aside-link icon="calendar2" :route="{ name: 'tasks-today' }"> 今天 </aside-link>
            <aside-link icon="tomorrow2" :route="{ name: 'tasks-tomorrow' }"> 明天 </aside-link>
            <aside-link icon="week" :route="{ name: 'tasks-week' }"> 最近 7 天 </aside-link>
            <aside-link icon="inbox" :route="{ name: 'tasks-inbox' }"> 收集箱 </aside-link>
        </nue-header>
        <nue-divider></nue-divider>
        <nue-main>
            <nue-collapse v-model="collapseItemsRecord">
                <nue-collapse-item name="projects">
                    <template #header="{ collapse, state }">
                        <nue-button
                            theme="pure"
                            :icon="state ? 'arrow-right' : 'arrow-down'"
                            @click="collapse"
                        >
                            <template #default>
                                <nue-div>
                                    <nue-text size="12px">清单</nue-text>
                                    <nue-text size="12px" color="gray">
                                        {{ projects.length }}
                                    </nue-text>
                                </nue-div>
                            </template>
                        </nue-button>
                        <nue-button
                            id="create-project-btn"
                            theme="pure"
                            icon="plus"
                            @click.stop="showCreateProjectDialog"
                        ></nue-button>
                    </template>
                    <aside-link
                        v-for="project in projects"
                        icon="more2"
                        :key="project.id"
                        :route="{ name: 'tasks-project', params: { projectId: project.id } }"
                    >
                        {{ project.title }}
                    </aside-link>
                </nue-collapse-item>
                <nue-collapse-item name="tags">
                    <template #header="{ collapse, state }">
                        <nue-button
                            theme="pure"
                            :icon="state ? 'arrow-right' : 'arrow-down'"
                            @click="collapse"
                        >
                            <template #default>
                                <nue-div>
                                    <nue-text size="12px">标签</nue-text>
                                    <nue-text size="12px" color="gray">
                                        {{ tags.length }}
                                    </nue-text>
                                </nue-div>
                            </template>
                        </nue-button>
                        <nue-button
                            id="create-tag-btn"
                            theme="pure"
                            icon="plus"
                            @click.stop="showCreateTagDialog"
                        ></nue-button>
                    </template>
                    <aside-link
                        v-for="tag in tags"
                        icon="tag"
                        :key="tag.id"
                        :route="{ name: 'tasks-tag', params: { tagId: tag.id } }"
                    >
                        {{ tag.name }}
                        <template #append>
                            <tag-color-dot :color="tag.color" size="small"></tag-color-dot>
                        </template>
                    </aside-link>
                </nue-collapse-item>
            </nue-collapse>
        </nue-main>
        <nue-divider></nue-divider>
        <nue-footer>
            <aside-link icon="delete" :route="{ name: 'tasks-recycle' }"> 垃圾桶 </aside-link>
        </nue-footer>
    </nue-container>
    <create-project-dialog
        ref="createProjectDialogRef"
        :handler="createProject"
    ></create-project-dialog>
    <create-tag-dialog ref="createTagDialogRef" @create="handleCreateTag"></create-tag-dialog>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useProjectStore, useTagStore, useUserStore } from '@/stores'
import { storeToRefs } from 'pinia'
import { CreateProjectDialog, CreateTagDialog, AsideLink, TagColorDot } from '@/components'
import { createProject} from '@/utils/project-handlers'
import { createTag } from '@/utils/tag-handlers'

defineOptions({ name: 'TasksViewAside' })

const projectStore = useProjectStore()
const tagStore = useTagStore()

const { projects } = storeToRefs(projectStore)
const { tags } = storeToRefs(tagStore)
const collapseItemsRecord = ref(['projects', 'tags'])
const createProjectDialogRef = ref<InstanceType<typeof CreateProjectDialog>>()
const createTagDialogRef = ref<InstanceType<typeof CreateTagDialog>>()

const showCreateProjectDialog = () => {
    createProjectDialogRef.value?.show()
}

const showCreateTagDialog = () => {
    createTagDialogRef.value?.show()
}

const handleCreateTag = async (payload: any) => {
    await createTag(payload.name, payload.color)
}
</script>

<style scoped>
@import url('./aside.css');
</style>
