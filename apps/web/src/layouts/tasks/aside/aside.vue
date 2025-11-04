<template>
    <nue-aside v-bind="$attrs">
        <nue-div vertical gap=".5rem">
            <nao-router-link
                icon="more2"
                :route="{ name: 'tasks-basic', params: { viewId: 'all' } }"
            >
                所有
            </nao-router-link>
            <nao-router-link
                icon="calendar2"
                :route="{ name: 'tasks-basic', params: { viewId: 'today' } }"
            >
                今天 - {{ useMoment().format('MM月DD日, dddd') }}
            </nao-router-link>
            <nao-router-link
                icon="tomorrow2"
                :route="{ name: 'tasks-basic', params: { viewId: 'tomorrow' } }"
            >
                明天
            </nao-router-link>
            <nao-router-link
                icon="week3"
                :route="{ name: 'tasks-basic', params: { viewId: 'week' } }"
            >
                本周
            </nao-router-link>
            <nao-router-link
                icon="inbox"
                :route="{ name: 'tasks-basic', params: { viewId: 'inbox' } }"
            >
                收集箱
            </nao-router-link>
        </nue-div>
        <nue-divider />
        <nue-collapse theme="smart-lists" v-model="collapseItemsRecord">
            <project-smart-list />
            <filter-smart-list />
            <tag-smart-list />
        </nue-collapse>
        <nue-divider />
        <nue-div vertical gap=".5rem">
            <nao-router-link
                icon="time"
                :route="{ name: 'tasks-basic', params: { viewId: 'overdue' } }"
            >
                已过期
            </nao-router-link>
            <nao-router-link
                icon="heart"
                :route="{ name: 'tasks-basic', params: { viewId: 'favourite' } }"
            >
                已收藏
            </nao-router-link>
            <nao-router-link
                icon="clear"
                :route="{ name: 'tasks-basic', params: { viewId: 'givenup' } }"
            >
                已放弃
            </nao-router-link>
            <nao-router-link
                icon="delete"
                :route="{ name: 'tasks-basic', params: { viewId: 'deleted' } }"
            >
                垃圾桶
            </nao-router-link>
        </nue-div>
    </nue-aside>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useMoment } from '@nao-todo/utils'
import { NaoRouterLink } from '@/components/ui'
import { ProjectSmartList, FilterSmartList, TagSmartList } from '@/components/tasks'

defineOptions({ name: 'TasksAside' })

const collapseItemsRecord = ref(['projects', 'filters', 'tags'])
</script>

