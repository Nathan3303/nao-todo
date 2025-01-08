<template>
    <view class="todo-table">
        <!--        <todo-table-header />-->
        <todo-table-main />
    </view>
</template>

<script lang="ts" setup>
// import TodoTableHeader from './header.vue'
import TodoTableMain from './main.vue'

defineOptions({ name: 'TodoTable' })
</script>

<style scoped>
.todo-table {
    display: flex;
    flex-direction: column;
    align-items: stretch;
    gap: 1rem;
    padding: 1rem;
    width: 100vw;
    margin-top: -1rem;
    box-sizing: border-box;
}
</style>
