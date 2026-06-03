<script lang="ts" setup>
import { nextTick, onMounted, ref, watch } from 'vue'
import { NueTextarea } from 'nue-ui'
import { parse2RelativeDate } from '@nao-todo/infrastructure/utils'
import type { CommentRowProps, CommentRowEmits } from './types'

defineOptions({ name: 'CommentRow' })
const props = defineProps<CommentRowProps>()
defineEmits<CommentRowEmits>()

const editInputerRef = ref<InstanceType<typeof NueTextarea>>()
const shadowContent = ref<string>(props.comment.content || '')
const isEditing = ref(false)
const loading = ref(false)
const deleting = ref(false)
const isClamped = ref(true)
const textRef = ref<any>()
const isOverflowing = ref(false)

const checkOverflow = () => {
    nextTick(() => {
        const el = textRef.value?.$el as HTMLElement | undefined
        if (!el) return
        isOverflowing.value = el.scrollHeight > el.clientHeight
    })
}

onMounted(() => checkOverflow())

watch(
    () => props.comment.content,
    () => checkOverflow(),
    { immediate: true, deep: true }
)

const handleEditComment = () => {
    isEditing.value = true
    nextTick(() => editInputerRef.value?.innerInputRef.focus())
}

const handleUpdateComment = async () => {
    if (!props.updater) {
        handleCancelEdit()
        return
    }
    if (shadowContent.value === props.comment.content) {
        handleCancelEdit()
        return
    }
    loading.value = true
    const err = await props.updater(props.comment.id, shadowContent.value)
    loading.value = false
    if (err) return
    handleCancelEdit()
}

const handleDeleteComment = async () => {
    if (!props.deleter) return
    deleting.value = true
    await props.deleter(props.comment.id)
    deleting.value = false
}

const handleCancelEdit = () => {
    shadowContent.value = props.comment.content || ''
    isEditing.value = false
}
</script>

<template>
    <nue-div theme="comment-row">
        <nue-avatar :src="comment.avatar || ''" />
        <nue-div theme="details">
            <nue-div theme="title">
                <nue-text theme="nickname">{{ comment.nickname }}</nue-text>
                <nue-text theme="datetime">
                    {{ parse2RelativeDate(comment.createdAt) }}
                </nue-text>
                <nue-div theme="actions">
                    <nue-icon v-show="!isEditing" name="edit" @click="handleEditComment" />
                    <nue-icon
                        :name="deleting ? 'loading' : 'delete'"
                        :spin="deleting"
                        @click="handleDeleteComment"
                    />
                </nue-div>
            </nue-div>
            <nue-div theme="content">
                <template v-if="isEditing">
                    <nue-textarea
                        ref="editInputerRef"
                        v-model="shadowContent"
                        :autosize="{ minRows: 1, maxRows: 8 }"
                        counter="word-limit"
                        maxlength="512"
                        theme="small,fix-padding"
                    >
                        <template #actions>
                            <nue-div gap="4px">
                                <nue-button icon="check" theme="small" @click="handleUpdateComment">
                                    修改
                                </nue-button>
                                <nue-button icon="clear" theme="small" @click="handleCancelEdit">
                                    取消
                                </nue-button>
                            </nue-div>
                        </template>
                    </nue-textarea>
                </template>
                <template v-else>
                    <nue-text ref="textRef" theme="pre" :clamped="isClamped ? 8 : 0">
                        {{ shadowContent }}
                    </nue-text>
                    <nue-button v-if="isOverflowing" theme="pure" @click="isClamped = !isClamped">
                        {{ isClamped ? '查看所有 +' : '收起 -' }}
                    </nue-button>
                </template>
            </nue-div>
        </nue-div>
    </nue-div>
</template>

<style scoped>
@import './row.css';
</style>

