<template>
    <nue-div class="tag-card" theme="card" gap="8px">
        <nue-div vertical gap="8px" flex>
            <nue-div align="center" justify="space-between">
                <nue-text size="16px" :clamped="1">{{ tag.name }}</nue-text>
                <nue-div class="tag-card__ops" align="center" width="fit-content">
                    <slot name="ops"></slot>
                </nue-div>
            </nue-div>
        </nue-div>
        <nue-text size="12px" color="gray">
            标签状态：{{ tag.isDeleted ? '已删除' : '正常' }}
        </nue-text>
    </nue-div>
</template>

<script setup lang="ts">
import type { TagCardProps, TagCardEmits } from './types'

defineOptions({ name: 'TagCard' })
defineProps<TagCardProps>()
const emit = defineEmits<TagCardEmits>()
</script>

<style scoped>
@import url('./card.css');
</style>
