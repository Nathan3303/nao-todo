<template>
    <nue-popup v-model:visible="visible" title="创建 Todo">
        <nue-div vertical>
            <nue-input
                ref="todoNameInputRef"
                v-model="inputValue"
                placeholder="输入 Todo 名称"
                @keyup.enter="handleConfirm"
            />
        </nue-div>
        <template #footer>
            <nue-button class="outter-cancel-button" @click.stop="visible = false">
                取消
            </nue-button>
            <nue-button class="outter-confirm-button" @click.stop="handleConfirm">
                创建
            </nue-button>
        </template>
    </nue-popup>
</template>

<script setup lang="ts">
import { nextTick, ref, watch } from 'vue'

defineOptions({ name: 'AddTodoPopup' })
const visible = defineModel('visible')
const emit = defineEmits(['confirm'])

const todoNameInputRef = ref()
const inputValue = ref('')

function handleConfirm() {
    emit('confirm', inputValue.value)
    inputValue.value = ''
}

watch(
    () => visible.value,
    (newValue) => {
        if (newValue) {
            nextTick(() => {
                todoNameInputRef.value.innerInputRef.focus()
            })
        }
    }
)
</script>
