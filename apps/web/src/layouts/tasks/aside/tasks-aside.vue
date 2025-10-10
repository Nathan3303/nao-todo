<template>
    <nue-aside v-bind="$attrs">
        <nue-div vertical align="stretch" gap=".5rem">
            <nao-router-link icon="more2" :route="makeRouteString('all')">所有</nao-router-link>
            <nao-router-link icon="calendar2" :route="makeRouteString('today')">
                今天 - {{ now }}
            </nao-router-link>
            <nao-router-link icon="tomorrow2" :route="makeRouteString('tomorrow')">
                明天
            </nao-router-link>
            <nao-router-link icon="week3" :route="makeRouteString('week')">本周</nao-router-link>
            <nao-router-link icon="inbox" :route="makeRouteString('inbox')">收集箱</nao-router-link>
        </nue-div>
        <nue-divider />
        <nue-collapse theme="smart-lists" v-model="collapseItemsRecord">
            <project-smart-list />
            <filter-smart-list />
            <tag-smart-list />
        </nue-collapse>
        <nue-divider />
        <nue-div vertical align="stretch" gap=".5rem">
            <nao-router-link icon="time" :route="makeRouteString('overdue')">
                已过期
            </nao-router-link>
            <nao-router-link icon="heart" :route="makeRouteString('favorite')">
                已收藏
            </nao-router-link>
            <nao-router-link icon="clear" :route="makeRouteString('givenup')">
                已放弃
            </nao-router-link>
            <nao-router-link icon="delete" :route="makeRouteString('recycle')">
                垃圾桶
            </nao-router-link>
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

const makeRouteString = (id: string) => ({ name: 'tasks-basic', params: { id } })
</script>
