<template>
    <nue-dialog
        :model-value="modelValue"
        @update:model-value="(value) => $emit('update:modelValue', value ?? false)"
        title="头像查看"
    >
        <nue-avatar :src="avatarUrl" alt="头像" theme="viewer" />
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

.nue-avatar--viewer {
    min-width: 200px;
    min-height: 200px;
    max-width: 80vw;
    max-height: 80vh;
    object-fit: contain;
    border-radius: 0.5rem;
}
</style>

