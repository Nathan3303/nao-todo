<template>
    <nue-dialog ref="dialogRef" v-model="visible" title="清单管理">
        <nue-div class="project-manage-dialog" vertical align="stretch">
            <nue-empty>
                <template #description>
                    清单管理功能正在开发中，敬请期待
                </template>
            </nue-empty>
        </nue-div>
    </nue-dialog>
</template>

<script setup lang="ts">
import { ref, nextTick, watch } from 'vue'
import { NueMessage, NueInput, NueConfirm } from 'nue-ui'
import type { CreateProjectDialogEmits, CreateProjectDialogProps } from './types'

defineOptions({ name: 'CreateProjectDialog' })
// const props = defineProps<CreateProjectDialogProps>()
// const emit = defineEmits<CreateProjectDialogEmits>()

const visible = ref(false)

const showCreateProjectDialog = () => {
    visible.value = true
}

defineExpose({
    show: showCreateProjectDialog
})
</script>

<style scoped>
.project-manage-dialog {
    aspect-ratio: 16 / 9;
    min-height: 600px;
}
</style>
