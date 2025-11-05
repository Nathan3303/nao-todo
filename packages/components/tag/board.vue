<script lang="ts" setup>
import { TagCard, TagColorDot } from '.'
import { Loading } from '@nao-todo/components/general'
import type { Tag } from '@nao-todo/types'

type TagBoardProps = {
    loadingState?: boolean
    tags: Tag[]
}
type TagBoardEmits = {
    (event: 'delete', tagId: Tag['id']): void
    (event: 'recolor', tagId: Tag['id']): void
}

defineOptions({ name: 'TagBoard', inheritAttrs: false })
defineProps<TagBoardProps>()
const emit = defineEmits<TagBoardEmits>()
</script>

<template>
    <div class="tag-board-wrapper" style="height: 100%">
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
        <nue-empty v-else image-size="6rem" style="height: 100%" />
    </div>
</template>

<style scoped>
.tag-board {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(min(240px, 100%), 1fr));
    grid-gap: 12px;

    .tag-card {
        min-height: fit-content;
    }
}
</style>

