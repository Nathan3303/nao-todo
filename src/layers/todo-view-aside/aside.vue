<template>
    <nue-container class="tasks-view-aside">
        <nue-header>
            <aside-link icon="more2" :route="{ name: 'tasks-all' }">所有</aside-link>
            <aside-link icon="calendar2" :route="{ name: 'tasks-today' }">今天</aside-link>
            <aside-link icon="tomorrow2" :route="{ name: 'tasks-tomorrow' }">明天</aside-link>
            <aside-link icon="week" :route="{ name: 'tasks-week' }">最近 7 天</aside-link>
            <aside-link icon="inbox" :route="{ name: 'tasks-inbox' }">收集箱</aside-link>
        </nue-header>
        <nue-divider />
        <nue-main>
            <nue-collapse v-model="collapseItemsRecord">
                <project-smart-list />
                <tag-smart-list />
            </nue-collapse>
        </nue-main>
        <nue-divider />
        <nue-footer>
            <aside-link icon="delete" :route="{ name: 'tasks-recycle' }">垃圾桶</aside-link>
        </nue-footer>
    </nue-container>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { AsideLink } from '@/components'
import ProjectSmartList from '../project-smart-list/project-smart-list.vue'
import TagSmartList from '../tag-smart-list/tag-smart-list.vue'

defineOptions({ name: 'TasksViewAside' })

const collapseItemsRecord = ref(['projects', 'tags'])
</script>

<style scoped>
@import url('./aside.css');
</style>
