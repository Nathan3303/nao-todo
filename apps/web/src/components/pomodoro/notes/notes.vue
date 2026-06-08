<script setup lang="ts">
import { computed } from 'vue'

defineOptions({ name: 'PomodoroNotesComp' })
const props = defineProps<{ noteText: string }>()
const emit = defineEmits<{
    (e: 'save'): void
    (e: 'update:noteText', value: string): void
}>()

// 通过 computed get/set 实现双向绑定
const localNote = computed({
    get: () => props.noteText,
    set: (value: string) => emit('update:noteText', value)
})
</script>

<template>
    <nue-div theme="pomodoro-notes-comp">
        <nue-textarea
            theme="inputer,fix-padding,pure,fit-wrapper"
            v-model="localNote"
            placeholder="你在思考什么？在这里记录详细见解、任务突破或深度头脑风暴 ..."
            maxlength="1000"
            counter="both"
        >
            <template #prefix>
                <nue-div theme="header">
                    <nue-icon name="edit" />
                    <nue-text theme="title">专注笔记</nue-text>
                </nue-div>
            </template>
            <!-- <template #actions>
                <nue-button :disabled="!localNote.length" theme="small" @click="emit('save')">
                    保存草稿
                </nue-button>
            </template> -->
        </nue-textarea>
    </nue-div>
</template>

<style scoped>
.nue-div--pomodoro-notes-comp {
    flex-direction: column;
    gap: var(--nue-gap-xs);

    > .nue-textarea--inputer {
        padding: 0;
        flex: 0 0 auto;

        > .nue-div--header {
            align-items: center;
            gap: var(--nue-gap-xs);
            margin-bottom: var(--nue-padding-sm);

            > .nue-icon.icon-edit {
                font-size: var(--nue-text-df);
            }

            > .nue-text--title {
                font-size: var(--nue-text-df2);
                font-weight: 500;
            }
        }

        &:deep(textarea) {
            resize: none;
            padding: var(--nue-padding-df);
            background-color: var(--nue-primary-color-100);
            border-radius: var(--nue-primary-radius);
        }
    }

    > .nue-textarea--fit-wrapper {
        flex: auto;

        &:deep(textarea) {
            height: auto !important;
            flex: auto;
            min-height: unset;
            max-height: unset;
        }
    }
}
</style>

