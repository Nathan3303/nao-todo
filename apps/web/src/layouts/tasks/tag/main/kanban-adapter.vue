<script setup lang="ts">
defineOptions({ name: 'TasksKanbanAdapter' })
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
                </nue-empty>
            </nue-content>
        </nue-main>
    </nue-container>
</template>

<style scoped></style>
