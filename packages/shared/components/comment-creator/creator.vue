<script lang="ts" setup>
import { ref, onMounted } from 'vue'
import { NueTextarea, NueMessage } from 'nue-ui'
import type { CommentCreatorProps, CommentCreatorEmits } from './types'

defineOptions({ name: 'CommentCreator' })
const props = defineProps<CommentCreatorProps>()
const emit = defineEmits<CommentCreatorEmits>()

const leaveCommentInputRef = ref<InstanceType<typeof NueTextarea>>()
const commentContent = ref('')
const loading = ref(false)

const handleSubmit = async () => {
    if (!commentContent.value) {
        NueMessage.warn('评论内容不能为空')
        return
    }
    if (commentContent.value.length > 360) {
        NueMessage.warn('评论内容不能超过360个字')
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

<template>
    <nue-div theme="comment-creator">
        <nue-textarea
            ref="leaveCommentInputRef"
            v-model="commentContent"
            :autosize="{ minRows: 1, maxRows: 4 }"
            counter="word-limit"
            maxlength="360"
            placeholder="添加评论"
            theme="fix-padding,small"
            spellcheck="false"
        >
            <template #actions>
                <nue-div gap=".5rem">
                    <nue-button :loading="loading" icon="check" theme="small" @click="handleSubmit">
                        添加
                    </nue-button>
                    <nue-button icon="clear" theme="small" @click="emit('cancel')">取消</nue-button>
                </nue-div>
            </template>
        </nue-textarea>
    </nue-div>
</template>

<style scoped>
.nue-div--comment-creator {
    flex-direction: column;
    gap: 0.5rem;
    width: 100%;
}
</style>