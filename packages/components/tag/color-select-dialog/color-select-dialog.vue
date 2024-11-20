<template>
    <nue-dialog v-model="visible" title="标签颜色修改" :closable="!loading">
        <nue-div vertical align="stretch">
            <nue-text size="12px" color="gray">请选择新的标签颜色:</nue-text>
            <tag-color-selector v-model="tagColor" />
        </nue-div>
        <template #footer="{ cancel }">
            <nue-button @click="cancel">取消</nue-button>
            <nue-button theme="primary" @click="handleSelect">确认</nue-button>
        </template>
    </nue-dialog>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { TagColorSelector } from '@nao-todo/components'
import type { Tag } from '@nao-todo/types'

defineOptions({ name: 'TagColorSelectDialog' })
const props = defineProps<{
    handler?: (tagId: Tag['id'], color: Tag['color']) => Promise<boolean>
}>()

const visible = ref(false)
const loading = ref(false)
const tagColor = ref('')
let tagIdTemp: Tag['id'] = ''

const handleShow = (tagId: Tag['id'], currentColor: Tag['color']) => {
    visible.value = true
    tagColor.value = currentColor
    tagIdTemp = tagId
}

const handleSelect = async () => {
    const newColor = tagColor.value || 'transparent'
    try {
        loading.value = true
        if (props.handler) await props.handler(tagIdTemp, newColor)
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
