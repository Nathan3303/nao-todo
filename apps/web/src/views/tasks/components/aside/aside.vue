<script setup lang="ts">
import { FilterSmartList, ProjectSmartList, TagSmartList } from './smart-list'
import { AsideLink } from '@nao-todo/components'
import { ref } from 'vue'
import { useMoment } from '@nao-todo/utils'

const now = useMoment()
const collapseItemsRecord = ref(['projects', 'filters', 'tags'])
</script>

<template>
    <aside-link icon="more2" route-name="tasks-all">所有</aside-link>
    <aside-link icon="calendar2" route-name="tasks-today">
        今天 - {{ now.format('MM月DD日, dddd') }}
    </aside-link>
    <aside-link icon="tomorrow2" route-name="tasks-tomorrow">明天</aside-link>
    <aside-link icon="week3" route-name="tasks-week">本周</aside-link>
    <aside-link icon="inbox" route-name="tasks-inbox">收集箱</aside-link>
    <nue-divider />
    <nue-collapse v-model="collapseItemsRecord">
        <project-smart-list />
        <filter-smart-list />
        <tag-smart-list />
    </nue-collapse>
    <nue-divider />
    <aside-link icon="heart" route-name="tasks-favorite">已收藏</aside-link>
    <aside-link icon="delete" route-name="tasks-recycle">垃圾桶</aside-link>
</template>

<style scoped></style>
