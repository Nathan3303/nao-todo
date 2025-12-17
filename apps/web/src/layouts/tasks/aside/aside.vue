<script setup lang="ts">
import { ref } from 'vue'
import { useMoment } from '@nao-todo/utils'
import { ProjectSmartList, FilterSmartList, TagSmartList } from '@/components/tasks'
import { useTasksViewStore } from '@/stores/tasks'
import { storeToRefs } from 'pinia'

defineOptions({ name: 'TasksAside' })

const tasksViewStore = useTasksViewStore()

const { tasksAsideNavLinkVisible } = storeToRefs(tasksViewStore)

const collapseItemsRecord = ref(
    ['projects', tasksAsideNavLinkVisible.value.filter ? 'filters' : '', 'tags'].filter(Boolean)
)
</script>

<template>
    <nue-aside theme="tasks-aside" v-bind="$attrs">
        <nue-div theme="block">
            <nue-link
                icon="more2"
                v-if="tasksAsideNavLinkVisible.all"
                :route="{ name: 'tasks-basic', params: { viewId: 'all' } }"
                theme="route"
            >
                所有
            </nue-link>
            <nue-link
                icon="calendar2"
                v-if="tasksAsideNavLinkVisible.today"
                :route="{ name: 'tasks-basic', params: { viewId: 'today' } }"
                theme="route"
            >
                今天 - {{ useMoment().format('MM月DD日, dddd') }}
            </nue-link>
            <nue-link
                icon="tomorrow"
                v-if="tasksAsideNavLinkVisible.tomorrow"
                :route="{ name: 'tasks-basic', params: { viewId: 'tomorrow' } }"
                theme="route"
            >
                明天
            </nue-link>
            <nue-link
                icon="week"
                v-if="tasksAsideNavLinkVisible.week"
                :route="{ name: 'tasks-basic', params: { viewId: 'week' } }"
                theme="route"
            >
                本周
            </nue-link>
            <nue-link
                icon="inbox2-fill"
                v-if="tasksAsideNavLinkVisible.inbox"
                :route="{ name: 'tasks-basic', params: { viewId: 'inbox' } }"
                theme="route"
            >
                收集箱
            </nue-link>
        </nue-div>
        <nue-divider />
        <nue-collapse theme="menu" v-model="collapseItemsRecord">
            <project-smart-list />
            <filter-smart-list />
            <tag-smart-list />
        </nue-collapse>
        <nue-divider />
        <nue-div theme="block">
            <nue-link
                icon="overdue"
                v-if="tasksAsideNavLinkVisible.overdue"
                :route="{ name: 'tasks-basic', params: { viewId: 'overdue' } }"
                theme="route"
            >
                已过期
            </nue-link>
            <nue-link
                icon="heart-fill"
                v-if="tasksAsideNavLinkVisible.favorite"
                :route="{ name: 'tasks-basic', params: { viewId: 'favourite' } }"
                theme="route"
            >
                收藏夹
            </nue-link>
            <!-- <nue-link
                icon="clear"
                :route="{ name: 'tasks-basic', params: { viewId: 'givenup' } }"
                theme="route"
            >
                已放弃
            </nue-link> -->
            <nue-link
                icon="recycle-bin"
                v-if="tasksAsideNavLinkVisible.deleted"
                :route="{ name: 'tasks-basic', params: { viewId: 'deleted' } }"
                theme="route"
            >
                垃圾桶
            </nue-link>
        </nue-div>
    </nue-aside>
</template>

<style scoped>
.nue-aside.nue-aside--tasks-aside {
    display: flex;
    flex-direction: column;
    gap: 1rem;

    .nue-div--block {
        flex-direction: column;
        gap: 0.5rem;
    }

    .nue-collapse--menu {
        gap: 0;

        .nue-collapse-item {
            border: none;
        }
    }
}
</style>

