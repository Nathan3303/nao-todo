<script setup lang="ts">
import { type Component, shallowRef, watchEffect } from 'vue'
import { storeToRefs } from 'pinia'
import { useTasksViewStore } from '@/stores/tasks'
import { BasicViewTable, BasicViewKanban } from './basic'
import { ProjectViewTable, ProjectViewKanban } from './project'
import { TagViewTable, TagViewKanban } from './tag'

defineOptions({ name: 'TasksMain' })

const tasksViewStore = useTasksViewStore()

const { viewProps } = storeToRefs(tasksViewStore)
const comp = shallowRef<Component>()
const comps = {
    basic: { table: BasicViewTable, kanban: BasicViewKanban },
    project: { table: ProjectViewTable, kanban: ProjectViewKanban },
    tag: { table: TagViewTable, kanban: TagViewKanban }
}

watchEffect(() => {
    if (!viewProps.value) return
    const category = viewProps.value.category
    const preference = viewProps.value.preference || 'table'
    if (!category || !preference) return
    comp.value =
        comps[category as keyof typeof comps][
            preference.viewType as keyof (typeof comps)[keyof typeof comps]
        ]
})
</script>

<template>
    <nue-container id="TasksMainContainer">
        <nue-main>
            <nue-content fill style="overflow: hidden">
                <component v-if="comp && viewProps" :is="comp" />
            </nue-content>
        </nue-main>
    </nue-container>
</template>
