<template>
    <nue-aside v-bind="$attrs">
        <nue-div vertical align="stretch" gap=".5rem">
            <nao-router-link icon="more2" to="/tasks/basic/all">所有</nao-router-link>
            <nao-router-link icon="calendar2" to="/tasks/basic/today">
                今天 - {{ now }}
            </nao-router-link>
            <nao-router-link icon="tomorrow2" to="/tasks/basic/tomorrow">明天</nao-router-link>
            <nao-router-link icon="week3" to="/tasks/basic/week">本周</nao-router-link>
            <nao-router-link icon="inbox" to="/tasks/basic/inbox">收集箱</nao-router-link>
        </nue-div>
        <nue-divider />
        <nue-collapse theme="smart-lists" v-model="collapseItemsRecord">
            <project-smart-list />
            <filter-smart-list />
            <tag-smart-list />
        </nue-collapse>
        <nue-divider />
        <nue-div vertical align="stretch" gap=".5rem">
            <nao-router-link icon="heart" to="/tasks/basic/favorite">已收藏</nao-router-link>
            <nao-router-link icon="clear" to="/tasks/basic/giveup">已放弃</nao-router-link>
            <nao-router-link icon="delete" to="/tasks/basic/recycle">垃圾桶</nao-router-link>
        </nue-div>
    </nue-aside>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useMoment } from '@nao-todo/utils'
import { NaoRouterLink } from '@/components/ui'
import { FilterSmartList, ProjectSmartList, TagSmartList } from '@/components/tasks'

defineOptions({ name: 'TasksAside' })

const now = useMoment().format('MM月DD日, dddd')
const collapseItemsRecord = ref(['projects', 'filters', 'tags'])
</script>
