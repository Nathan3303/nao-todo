<script lang="ts" setup>
import { TagCard } from '../tag-card'
import { Loading } from '../loading'
import type { TagBoardProps, TagBoardEmits } from './types'

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
                        <slot name="ops" :tag="tag">
                            <nue-tooltip content="删除标签" size="small">
                                <nue-button
                                    icon="delete"
                                    theme="pure,pure-icon"
                                    @click="emit('delete', tag.id)"
                                />
                            </nue-tooltip>
                        </slot>
                    </template>
                </tag-card>
            </div>
        </template>
        <nue-empty v-else image-size="6rem" style="height: 100%" description="暂无标签" />
    </div>
</template>

<style scoped>
.tag-board {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(min(200px, 100%), 1fr));
    grid-gap: 12px;

    .tag-card {
        min-height: fit-content;
    }
}
</style>

