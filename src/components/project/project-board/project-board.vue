<template>
    <div class="project-board-wrapper">
        <loading v-show="loadingState"></loading>
        <div class="project-board">
            <slot>
                <empty :empty="isEmpty"></empty>
                <project-card
                    v-for="project in projects"
                    :key="project.id"
                    :project="project"
                    :allow-route="allowRoute"
                ></project-card>
            </slot>
        </div>
    </div>
</template>

<script setup lang="ts">
import { computed, useSlots } from 'vue'
import { Loading, Empty, ProjectCard } from '@/components'
import type { ProjectBoardProps, ProjectBoardEmits } from './types'

defineOptions({ name: 'ProjectBoard' })
const props = defineProps<ProjectBoardProps>()
const emit = defineEmits<ProjectBoardEmits>()

const slots = useSlots()

const isEmpty = computed(() => {
    const { projects } = props
    if (!projects) return true
    return !projects.length && !slots.default
})
</script>

<style scoped>
@import url(./project-board.css);
</style>
