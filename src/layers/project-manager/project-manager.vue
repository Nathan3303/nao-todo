<template>
    <nue-dialog ref="dialogRef" v-model="visible" title="清单管理">
        <nue-div class="project-manager" vertical align="stretch">
            <nue-empty description="清单管理功能正在开发中" />
        </nue-div>
    </nue-dialog>
</template>

<script setup lang="ts">
import { ref, nextTick, watch } from 'vue'
import { useProjectStore } from '@/stores'
import { NueMessage, NueInput, NueConfirm } from 'nue-ui'
import type { CreateProjectDialogEmits, CreateProjectDialogProps } from './types'

defineOptions({ name: 'ProjectManager' })
// const props = defineProps<CreateProjectDialogProps>()
// const emit = defineEmits<CreateProjectDialogEmits>()

const projectStore = useProjectStore()

const visible = ref(false)

defineExpose({
    show: () => (visible.value = true)
})
</script>

<style scoped>
@import url('./project-manager.css');
</style>
