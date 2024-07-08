<template>
    <nue-dialog v-model="visible" title="Project information">
        <project-details :project="project"></project-details>
    </nue-dialog>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import type { ProjectDetailsDialogProps } from './types'
import { ProjectDetails } from '../project-details'

defineProps<ProjectDetailsDialogProps>()

const visible = ref(false)

const showProjectDetailsDialog = () => {
    visible.value = true
}

defineExpose({
    show: showProjectDetailsDialog
})
</script>

<style scoped></style>
