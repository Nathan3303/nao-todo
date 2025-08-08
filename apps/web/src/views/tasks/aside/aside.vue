<script setup lang="ts">
import { ref } from 'vue'
import { useMoment } from '@nao-todo/utils'
import { NaoRouterLink } from '@/components/ui'
import { FilterSmartList, ProjectSmartList, TagSmartList } from './smart-lists'

defineOptions({ name: 'NaoTasksViewAside' })

const now = useMoment()
const collapseItemsRecord = ref(['projects', 'filters', 'tags'])
</script>

<template>
    <nue-aside v-bind="$attrs">
        <nue-div vertical align="stretch" gap=".5rem">
            <nao-router-link icon="more2" to="tasks-all">所有</nao-router-link>
            <nao-router-link icon="calendar2" to="tasks-today">
                今天 - {{ now.format('MM月DD日, dddd') }}
            </nao-router-link>
            <nao-router-link icon="tomorrow2" to="tasks-tomorrow">明天</nao-router-link>
            <nao-router-link icon="week3" to="tasks-week">本周</nao-router-link>
            <nao-router-link icon="inbox" to="tasks-inbox">收集箱</nao-router-link>
        </nue-div>
        <nue-divider />
        <nue-collapse theme="smart-lists" v-model="collapseItemsRecord">
            <project-smart-list />
            <filter-smart-list />
            <tag-smart-list />
        </nue-collapse>
        <nue-divider />
        <nue-div vertical align="stretch" gap=".5rem">
            <nao-router-link icon="heart" to="tasks-favorite">已收藏</nao-router-link>
            <nao-router-link icon="clear" to="tasks-giveup">已放弃</nao-router-link>
            <nao-router-link icon="delete" to="tasks-recycle">垃圾桶</nao-router-link>
        </nue-div>
    </nue-aside>
</template>
