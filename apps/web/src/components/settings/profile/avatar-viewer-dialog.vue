<template>
    <nue-dialog
        :model-value="modelValue"
        @update:model-value="(value) => $emit('update:modelValue', value ?? false)"
        title="头像查看"
        theme="auto"
    >
        <nue-avatar :src="avatarUrl" alt="头像" size="fit-content"/>
    </nue-dialog>
</template>

<script setup lang="ts">
defineOptions({ name: 'SettingsProfileAvatarViewerDialog' })

interface Props {
    modelValue: boolean
    avatarUrl: string
}
interface Emits {
    (e: 'update:modelValue', value: boolean): void
}

defineProps<Props>()
defineEmits<Emits>()
</script>

<style scoped>
.avatar-viewer-container {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 1rem;
}
</style>

<style>
.nue-dialog--auto {
    min-width: 4rem;
    min-height: 4rem;
    max-width: 100vw;
    max-height: 100vh;
    width: fit-content;
    height: fit-content;
}
</style>

