<script setup lang="ts">
import { shallowRef, watchEffect, type Component } from 'vue'
import { storeToRefs } from 'pinia'
import { BasicViewHeader } from './basic'
import { ProjectViewHeader } from './project'
import { TagViewHeader } from './tag'
import { useTasksViewStore } from '@/stores/tasks'

defineOptions({ name: 'TasksMainHeader' })

const tasksViewStore = useTasksViewStore()

const { viewProps } = storeToRefs(tasksViewStore)
const comp = shallowRef<Component>()
const comps = { basic: BasicViewHeader, project: ProjectViewHeader, tag: TagViewHeader }

watchEffect(() => {
    const category = viewProps.value?.category
    if (!category) return
    comp.value = comps[category]
})
</script>

<template>
    <component v-if="comp && viewProps" :is="comp" />
</template>
