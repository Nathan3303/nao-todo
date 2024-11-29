<template>
    <nue-div align="stretch" theme="comment-creator" vertical>
        <nue-textarea
            ref="leaveCommentInputRef"
            v-model="commentContent"
            :rows="0"
            autosize
            counter="word-limit"
            maxlength="256"
            placeholder="添加评论"
            theme="small"
        />
        <!--        <nue-divider />-->
        <nue-div justify="space-between">
            <nue-div gap="8px" width="fit-content">
                <nue-button :loading="loading" icon="check" theme="small" @click="handleSubmit">
                    添加
                </nue-button>
                <nue-button icon="clear" theme="small" @click="emit('cancel')">取消</nue-button>
            </nue-div>
            <nue-div width="fit-content">
                <!--                <nue-button icon="files" theme="small">附件</nue-button>-->
            </nue-div>
        </nue-div>
    </nue-div>
</template>

<script lang="ts" setup>
import { ref, onMounted } from 'vue'
import { NueTextarea, NueMessage } from 'nue-ui'

defineOptions({ name: 'CommentCreator' })
const props = defineProps<{
    handler?: (content: string) => Promise<boolean>
}>()
const emit = defineEmits<{
    (e: 'submit', content: string): void
    (e: 'cancel'): void
}>()

const leaveCommentInputRef = ref<InstanceType<typeof NueTextarea>>()
const commentContent = ref('')
const loading = ref(false)

const handleSubmit = async () => {
    if (!commentContent.value) {
        NueMessage.warn('评论内容不能为空')
        return
    }
    if (commentContent.value.length > 256) {
        NueMessage.warn('评论内容不能超过256个字')
        return
    }
    if (!props.handler) {
        emit('submit', commentContent.value)
        return
    }
    loading.value = true
    const result = await props.handler(commentContent.value)
    loading.value = false
    if (!result) return
    commentContent.value = ''
    leaveCommentInputRef.value?.innerInputRef.focus()
}

onMounted(() => {
    leaveCommentInputRef.value?.innerInputRef.focus()
})
</script>

<style scoped>
.nue-div--comment-creator {
    gap: 8px;
}
</style>
