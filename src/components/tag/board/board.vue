<template>
    <div class="tag-board-wrapper">
        <loading v-if="loadingState" />
        <template v-else-if="tags && tags.length">
            <div class="tag-board">
                <tag-card v-for="tag in tags" :key="tag.id" :tag="tag">
                    <template #ops>
                        <nue-tooltip size="small" content="修改标签提示色">
                            <tag-color-dot
                                :color="tag.color"
                                @click="emit('recolor', tag.id)"
                                style="cursor: pointer"
                            />
                        </nue-tooltip>
                        <nue-tooltip size="small" content="删除标签">
                            <nue-button
                                theme="pure,pure-icon"
                                icon="delete"
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

<script setup lang="ts">
import TagCard from '../card/card.vue'
import { Loading } from '@/components/general'
import TagColorDot from '../color-dot/color-dot.vue'
import type { TagBoardProps, TagBoardEmits } from './types'

defineOptions({ name: 'TagBoard' })
defineProps<TagBoardProps>()
const emit = defineEmits<TagBoardEmits>()
</script>

<style scoped>
@import url('./board.css');
</style>
