<template>
    <nue-div class="tag-card" theme="card" gap="8px">
        <nue-div vertical gap="8px" flex>
            <nue-div align="center" justify="space-between">
                <nue-text size="16px" :clamped="1">
                    {{ tag.name }}
                </nue-text>
                <nue-div class="tag-card__ops" align="center" width="fit-content">
                    <slot name="ops" />
                </nue-div>
            </nue-div>
        </nue-div>
        <!--        <nue-text size="12px" color="gray">-->
        <!--            标签状态：{{ tag.isDeleted ? '已删除' : '正常' }}-->
        <!--        </nue-text>-->
    </nue-div>
</template>

<script setup lang="ts">
import type { Tag } from '@nao-todo/types'

defineOptions({ name: 'TagCard' })
defineProps<{
    tag: Tag
}>()
</script>

<style scoped>
.tag-card {
    flex-direction: column;
}

.tag-card[data-actived='false'] {
    background-color: #f2f2f2;
}

.tag-card[data-actived='false'] > * {
    opacity: 0.8;
}

.tag-card[data-actived='false'] .tag-card__footer-ops,
.tag-card[data-actived='false'] .tag-card__ops {
    opacity: 1;
}
</style>
