<template>
    <nue-dialog v-model="visible" title="标签颜色修改" :closable="!loading">
        <nue-div vertical align="stretch">
            <nue-text size="12px" color="gray">请选择新的标签颜色:</nue-text>
            <color-selector v-model="tagColor" />
        </nue-div>
        <template #footer="{ cancel }">
            <nue-button @click="cancel">取消</nue-button>
            <nue-button theme="primary" @click="handleSelect">确认</nue-button>
        </template>
    </nue-dialog>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import ColorSelector from '../color-selector/color-selector.vue'
import { useTagStore } from '@nao-todo/stores'
import { updateTag } from '@nao-todo/handlers/tag-handlers'
import type { Tag } from '@nao-todo/stores'

defineOptions({ name: 'TagColorSelectDialog' })

const tagStore = useTagStore()

const visible = ref(false)
const loading = ref(false)
const tagColor = ref('')
let tagIdTemp: Tag['id'] = ''

const getTagColor = async (tagId: Tag['id']) => {
    const tag = tagStore.findLocal(tagId)
    tagColor.value = tag && tag.color ? tag.color : ''
}

const handleShow = (tagId: Tag['id']) => {
    visible.value = true
    getTagColor(tagId)
    tagIdTemp = tagId
}

const handleSelect = async () => {
    const newColor = tagColor.value || 'transparent'
    try {
        loading.value = true
        await updateTag(tagIdTemp, { color: newColor })
        visible.value = false
    } catch (e) {
        console.warn('[TagColorSelectDialog] handleSelect:', e)
    } finally {
        loading.value = false
    }
}

defineExpose({
    show: handleShow
})
</script>

<style scoped></style>
