<template>
    <nue-div class="comment-row">
        <nue-avatar :src="comment.user.avatar" class="comment-row__avatar" size="32px" />
        <nue-div class="comment-row__details">
            <nue-div class="comment-row__details__title">
                <nue-text color="#696969" size="13px" weight="500">
                    {{ comment.user.nickname }}
                </nue-text>
                <nue-text color="#969696" size="12px">
                    <!--                    评论于-->
                    {{ useRelativeDate(comment.createdAt) }}
                </nue-text>
                <nue-div class="comment-row__details__actions">
                    <nue-icon
                        v-show="!isEditing"
                        name="edit"
                        size="13px"
                        @click="handleEditComment"
                    />
                    <nue-icon name="delete" size="13px" @click="emit('delete', comment.id)" />
                </nue-div>
            </nue-div>
            <nue-div align="stretch" gap="4px" vertical>
                <template v-if="isEditing">
                    <nue-textarea
                        ref="editInputerRef"
                        v-model="shadowContent"
                        :rows="0"
                        autosize
                        counter="word-limit"
                        maxlength="256"
                        theme="small"
                    />
                    <nue-div gap="4px">
                        <nue-button icon="check" theme="small" @click="handleUpdateComment">
                            修改
                        </nue-button>
                        <nue-button icon="clear" theme="small" @click="handleCancelEdit">
                            取消
                        </nue-button>
                    </nue-div>
                </template>
                <nue-text v-else color="#363636" size="12px" theme="pre">
                    {{ shadowContent }}
                </nue-text>
            </nue-div>
        </nue-div>
    </nue-div>
</template>

<script lang="ts" setup>
import { nextTick, ref } from 'vue'
import { useRelativeDate } from '@nao-todo/hooks'
import { NueMessage, NueTextarea } from 'nue-ui'

defineOptions({ name: 'CommentRow' })
const props = defineProps<{
    comment: {
        id: string
        content: string
        createdAt: string
        user: {
            nickname?: string
            avatar?: string
        }
    }
    updater?: (commentId: string, newContent: string) => Promise<boolean>
}>()
const emit = defineEmits<{
    (event: 'delete', commentId: string): void
    (event: 'edit', commentId: string, newContent: string): void
}>()

const editInputerRef = ref<InstanceType<typeof NueTextarea>>()
const shadowContent = ref<string>(props.comment.content || '')
const isEditing = ref(false)
const loading = ref(false)

const handleEditComment = () => {
    isEditing.value = true
    nextTick(() => editInputerRef.value?.innerInputRef.focus())
}

const handleUpdateComment = async () => {
    // emit('edit', props.comment.id, shadowContent.value)
    if (props.updater && shadowContent.value !== props.comment.content) {
        loading.value = true
        const updateResult = await props.updater(props.comment.id, shadowContent.value)
        loading.value = false
        if (!updateResult) {
            NueMessage.error('评论更新失败')
            return
        }
    }
    handleCancelEdit()
}

const handleCancelEdit = () => {
    shadowContent.value = props.comment.content || ''
    isEditing.value = false
}
</script>

<style scoped>
.comment-row {
    flex-wrap: nowrap;
    padding: 4px 8px;

    .comment-row__avatar {
        margin-top: 4px;
    }

    .comment-row__details {
        flex-direction: column;
        flex: auto;
        gap: 4px;
    }

    .comment-row__details__title {
        align-items: center;
        gap: 16px;
    }

    .comment-row__details__actions {
        opacity: 0;
        align-items: center;
        flex: auto;
        gap: 12px;
        justify-content: end;
        width: fit-content;
        color: var(--primary-color-600);

        .nue-icon:hover {
            cursor: pointer;
            color: var(--primary-color-900);
        }
    }

    .nue-text--pre {
        white-space: pre-wrap;
    }

    &:hover {
        .comment-row__details__actions {
            opacity: 1;
        }
    }
}
</style>
