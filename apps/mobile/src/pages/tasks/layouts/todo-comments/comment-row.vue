<script lang="ts" setup>
import type { Comment } from '@nao-todo/types'
import { useRelativeDate } from '@nao-todo/hooks'
import NuemIcon from '@/ui/icon.vue'

defineOptions({ name: 'CommentRow' })
defineProps<{
    comment?: Comment
}>()
</script>

<template>
    <view v-if="comment" class="comment-row">
        <view class="comment-row__avatar">
            <wd-img
                :enable-preview="true"
                :height="32"
                :src="comment.user.avatar"
                :width="32"
            />
        </view>
        <view class="comment-row__details">
            <view class="comment-row__details__title">
                <text>{{ comment.user.nickname }}</text>
                <text class="comment-row__details__date">
                    {{ useRelativeDate(comment.createdAt) }}
                </text>
                <view class="comment-row__details__actions">
                    <nuem-icon name="edit" />
                    <nuem-icon name="delete" />
                </view>
            </view>
            <view class="comment-row__details__content">
                {{ comment.content }}
            </view>
        </view>
    </view>
</template>

<style scoped>
.comment-row {
    display: flex;
    gap: 1rem;
    flex-wrap: nowrap;
}

.comment-row__avatar {
    width: 32px;
    flex: none;
}

.comment-row__details {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    flex: auto;
}

.comment-row__details__title,
.comment-row__details__actions {
    display: flex;
    gap: 0.5rem;
    flex-wrap: nowrap;
    font-size: var(--text-sm);
}

.comment-row__details__date {
    color: var(--primary-color-700);
}

.comment-row__details__actions {
    margin-left: auto;
}

.comment-row__details__content {
    font-size: var(--text-sm);
    line-height: 1.2;
}
</style>
