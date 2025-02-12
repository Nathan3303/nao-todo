<script setup lang="ts">
import useDialogManager from './use-dialog-manager'
import type { DialogManagerProps } from './types'

defineOptions({ name: 'NaoDialogManager' })
defineProps<DialogManagerProps>()

const { visible, loading, dialogInfo, show, setComponentInfoById } = useDialogManager()

defineExpose({ show, register: setComponentInfoById })
</script>

<template>
    <nue-dialog theme="widely" v-model="visible" :title="dialogInfo.title">
        <component :is="dialogInfo.component" v-bind="dialogInfo.payload" />
        <template v-if="useClassicButtons" #footer="{ cancel }">
            <nue-button :disabled="loading" @click.stop="cancel">取消</nue-button>
            <nue-button
                :loading="loading"
                theme="primary"
                @click="dialogInfo.payload?.confirmHandler"
            >
                创建
            </nue-button>
        </template>
    </nue-dialog>
</template>

<style scoped></style>
