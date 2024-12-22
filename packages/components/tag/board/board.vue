<template>
    <div class="tag-board-wrapper">
        <loading v-if="loadingState" />
        <template v-else-if="tags && tags.length">
            <div class="tag-board">
                <tag-card v-for="tag in tags" :key="tag.id" :tag="tag">
                    <template #ops>
                        <nue-tooltip content="修改标签提示色" size="small">
                            <tag-color-dot :color="tag.color" @click="emit('recolor', tag.id)" />
                        </nue-tooltip>
                        <nue-tooltip content="删除标签" size="small">
                            <nue-button
                                icon="delete"
                                theme="pure,pure-icon"
                                @click="emit('delete', tag.id)"
                            />
                        </nue-tooltip>
                    </template>
                </tag-card>
            </div>
        </template>
        <nue-empty v-else />
    </div>
</template>

<script lang="ts" setup>
import TagCard from '../card/card.vue'
import { Loading } from '@nao-todo/components/general'
import TagColorDot from '../color-dot/color-dot.vue'
import type { Tag } from '@nao-todo/types'

defineOptions({ name: 'TagBoard' })
defineProps<{
    loadingState?: boolean
    tags: Tag[]
}>()
const emit = defineEmits<{
    (event: 'delete', tagId: Tag['id']): void
    (event: 'recolor', tagId: Tag['id']): void
}>()
</script>

<style scoped>
.tag-board {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
    grid-gap: 12px;
}

.tag-board .tag-card {
    /* max-width: 220px; */
    min-height: fit-content;
}
</style>
