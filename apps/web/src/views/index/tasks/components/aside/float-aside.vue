<script setup lang="ts">
import { IndexAside } from '@/layers/index-aside'
import TasksAside from './aside.vue'

const routeLinks = [
    { name: '任务', icon: 'square-check-fill', route: '/tasks' },
    { name: '日历视图', icon: 'calendar', route: '/calendar' },
    { name: '番茄专注', icon: 'focus2', route: '/fqfocus' },
    { name: '搜索', icon: 'search2', route: '/search' },
    { name: '对话大模型', icon: 'ai-chat-fill', route: '/ai' }
]
</script>

<template>
    <index-aside>
        <tasks-aside />
        <template #footer>
            <nue-div wrap="nowrap" justify="space-around">
                <nue-tooltip
                    v-for="(rl, idx) in routeLinks"
                    :key="idx"
                    :content="rl.name"
                    placement="right-center"
                    size="small"
                >
                    <nue-link :icon="rl.icon" :route="rl.route" theme="index-header-link" />
                </nue-tooltip>
            </nue-div>
        </template>
    </index-aside>
</template>
