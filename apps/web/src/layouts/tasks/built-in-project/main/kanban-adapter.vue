<script setup lang="ts">
import { BUILT_IN_PROJECT_VIEW_CONTEXT_KEY } from '@/infrastructure/constants/tasks-view'
import type { BuiltInProjectViewContext } from '../types'
import { inject } from 'vue'

defineOptions({ name: 'TasksKanbanAdapter' })

const { switchViewTypeToTable } = inject<BuiltInProjectViewContext>(
    BUILT_IN_PROJECT_VIEW_CONTEXT_KEY
)!
</script>

<template>
    <nue-container>
        <nue-main>
            <nue-content fill overflow="hidden">
                <nue-empty
                    image-size="3rem"
                    image-src="/images/todo.webp"
                    description="看板视图规划中"
                    style="height: 100%"
                >
                    <nue-button theme="small,primary" @click="switchViewTypeToTable">
                        返回表格视图
                    </nue-button>
                </nue-empty>
            </nue-content>
        </nue-main>
    </nue-container>
</template>

<style scoped></style>
