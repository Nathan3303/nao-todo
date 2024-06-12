<template>
    <nue-drawer v-model:status="visible" title="Todo 详情">
        <nue-div class="todo-detail__content" vertical style="overflow: hidden; width: 100%">
            <nue-button
                theme="icon-only"
                :icon="currentTodo.status === 'done' ? 'icon-checked-fill' : 'icon-uncheck'"
                size="22px"
            />
            <nue-input
                size="20px"
                v-model="currentTodo.name"
                :clearable="false"
                placeholder="Todo 名称"
            />
            <nue-button>添加步骤</nue-button>
            <p class="list-line">
                <span class="list-line-label">提醒：</span>
                <span class="list-line-value">
                    <input
                        v-model="remindDate"
                        ref="remindInputRef"
                        type="date"
                        @change="handleSetRemind"
                    />
                </span>
            </p>
            <p class="list-line">
                <span class="list-line-label">截止日期:</span>
                <span class="list-line-value">
                    <input type="date" />
                </span>
            </p>
            <p class="list-line">
                <span class="list-line-label">重复:</span>
                <span class="list-line-value">
                    <input type="date" />
                </span>
            </p>
            <nue-textarea
                rows="1"
                v-model="currentTodo.description"
                placeholder="添加备注"
                autosize
            />
        </nue-div>

        <!-- Todo details drawer footer -->
        <template #footer>
            <nue-button icon="icon-shanchu" theme="no-border" @click.stop="handleDelete">
                Delete
            </nue-button>
        </template>
    </nue-drawer>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { storeToRefs } from 'pinia'
import { useTodoStore } from '@/stores/useTodoStore'
import { findOne } from '@/utils/utils'
import { NueMessage, NueConfirm } from 'nue-ui'

defineOptions({ name: 'TodoDetailsDrawer' })

const visible = defineModel('visible')

const todoStore = useTodoStore()

const { selectedTodoId } = storeToRefs(todoStore)

const remindInputRef = ref<HTMLInputElement>()
const remindDate = ref('')

const currentTodo = computed(() => {
    const todo = findOne(todoStore.todos, (item) => item.id === selectedTodoId.value)
    // console.log(todo)
    return todo
})

function handleDelete() {
    if (!selectedTodoId.value) return
    NueConfirm({
        title: '删除确认',
        content: '确认删除该待办事项吗？',
        confirmButtonText: '确认',
        cancelButtonText: '取消'
    }).then(
        () => {
            todoStore.remove(selectedTodoId.value!).then(
                () => {
                    NueMessage({ message: '待办事项删除成功', type: 'success' })
                    visible.value = false
                },
                (err) => {
                    NueMessage({ message: err, type: 'error' })
                }
            )
        },
        () => NueMessage({ message: '操作取消', type: 'info' })
    )
}

function handleSetRemind() {
    console.log(remindInputRef.value?.value)
    // console.dir(remindInputRef.value)
    // remindInputRef.value?.showPicker()
}
</script>
