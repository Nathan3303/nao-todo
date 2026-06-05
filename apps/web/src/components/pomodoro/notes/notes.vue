<script setup lang="ts">
import { ref } from 'vue'

defineOptions({ name: 'PomodoroNotesComp' })

const noteText = ref('')
</script>

<template>
    <nue-div theme="pomodoro-notes-comp">
        <nue-div theme="header">
            <nue-icon name="edit" />
            <nue-text theme="title">专注笔记</nue-text>
        </nue-div>
        <nue-textarea
            theme="inputer,fix-padding"
            v-model="noteText"
            placeholder="写下你的专注笔记 ..."
            maxlength="1000"
            :autosize="{ minRows: 1, maxRows: 16 }"
            counter="both"
        >
            <template #actions>
                <nue-button theme="small">保存草稿</nue-button>
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

