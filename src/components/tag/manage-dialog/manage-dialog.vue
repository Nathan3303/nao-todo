<template>
    <nue-dialog ref="dialogRef" v-model="visible" title="标签管理">
        <nue-div class="tag-manage-dialog" vertical align="stretch">
            <nue-empty>
                <template #description> 标签管理功能正在开发中，敬请期待 </template>
            </nue-empty>
        </nue-div>
    </nue-dialog>
</template>

<script setup lang="ts">
import { ref, nextTick, watch } from 'vue'
import { NueMessage, NueInput, NueConfirm } from 'nue-ui'
import type { TagManageDialogEmits, TagManageDialogProps } from './types'

defineOptions({ name: 'CreateProjectDialog' })
// const props = defineProps<TagManageDialogProps>()
// const emit = defineEmits<TagManageDialogEmits>()

const visible = ref(false)

defineExpose({
    show: () => (visible.value = true)
})
</script>

<style scoped>
.tag-manage-dialog {
    aspect-ratio: 16 / 9;
    min-height: 600px;
}
</style>
