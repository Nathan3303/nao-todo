<script setup lang="ts">
import { computed } from 'vue'

defineOptions({ name: 'PomodoroNotesComp' })

// @props
const props = defineProps<{
    noteText: string
}>()

// @emits
const emit = defineEmits<{
    save: []
    'update:noteText': [value: string]
}>()

// 通过 computed get/set 实现双向绑定
const localNote = computed({
    get: () => props.noteText,
    set: (value: string) => emit('update:noteText', value)
})
</script>

<template>
    <nue-div theme="pomodoro-notes-comp">
        <nue-div theme="header">
            <nue-icon name="edit" />
            <nue-text theme="title">专注笔记</nue-text>
        </nue-div>
        <nue-textarea
            theme="inputer,fix-padding"
            v-model="localNote"
            placeholder="写下你的专注笔记 ..."
            maxlength="1000"
            :autosize="{ minRows: 1, maxRows: 16 }"
            counter="both"
        >
            <template #actions>
                <nue-button theme="small" @click="emit('save')">保存草稿</nue-button>
            </template>
        </nue-textarea>
    </nue-div>
</template>

<style scoped>
.nue-div--pomodoro-notes-comp {
    flex-direction: column;
    gap: var(--nue-gap-xs);

    > .nue-div--header {
        align-items: center;
        gap: var(--nue-gap-xs);

        > .nue-icon.icon-edit {
            font-size: var(--nue-text-xl);
        }

        > .nue-text--title {
            font-size: var(--nue-text-df);
            font-weight: 500;
        }
    }

    > .nue-textarea--inputer {
        flex: 0 0 auto;

        &:deep(textarea) {
            resize: none;
        }
    }
}
</style>
