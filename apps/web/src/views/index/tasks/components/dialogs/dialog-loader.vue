<template>
    <nue-dialog
        :theme="dialogInfo.payload?.dialogSize ?? 'normal'"
        v-model="visible"
        :title="dialogInfo.title"
        ref="nueDialogRef"
    >
        <component
            :is="dialogInfo.component"
            :handler="dialogInfo.payload?.confirmHandler"
            v-bind="{ ...dialogInfo.payload?.props }"
            @close-dialog="() => nueDialogRef?.close()"
        />
    </nue-dialog>
</template>

<script setup lang="ts">
import { useDialogLoader } from './use-dialog-loader'
import type { DialogManagerProps } from './types'
import {
    OverdueTodoManager,
    ProjectCreator,
    ProjectManager,
    TagCreator,
    TagManager,
    TodoCreator
} from './dialogs'
import { NueDialog } from 'nue-ui'
import { ref } from 'vue'

defineOptions({ name: 'NaoDialogManager' })
defineProps<DialogManagerProps>()

const { visible, dialogInfo, show, setComponentInfoById } = useDialogLoader()

const nueDialogRef = ref<InstanceType<typeof NueDialog>>()

setComponentInfoById('ProjectManager', ['清单管理', ProjectManager])
setComponentInfoById('TagManager', ['标签管理', TagManager])
setComponentInfoById('OverdueTodoManager', ['过期任务管理', OverdueTodoManager])
setComponentInfoById('ProjectCreator', ['新建任务清单', ProjectCreator])
setComponentInfoById('TagCreator', ['新建标签', TagCreator])
setComponentInfoById('TodoCreator', ['新建任务', TodoCreator])

defineExpose({ show, register: setComponentInfoById })
</script>

<style scoped></style>
