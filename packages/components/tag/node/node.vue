<template>
    <nue-div class="tag-node" width="fit-content">
        <nue-text color="white">{{ tag.name }}</nue-text>
        <nue-icon
            v-if="!readonly"
            class="tag-node__delete-button"
            name="clear"
            @click="handleDelete(tag.id)"
        />
    </nue-div>
</template>

<script lang="ts" setup>
defineOptions({ name: 'TagNode' })
defineProps<{
    tag: {
        id: string
        name: string
        color: string
    }
    deletable?: boolean
    readonly?: boolean
}>()
const emit = defineEmits<{
    (event: 'delete', id: string): void
}>()

const handleDelete = (id: string) => {
    emit('delete', id)
}
</script>

<style scoped>
.tag-node {
    width: fit-content;
    height: 24px;
    line-height: 23px;
    padding: 0 8px;
    align-items: center;
    background-color: v-bind('tag.color');
    border-radius: 16px;
    position: relative;
    cursor: default;
}

.tag-node > .nue-text {
    color: white !important;
    font-size: 12px;
}

.tag-node .tag-node__delete-button {
    --icon-size: 14px;
    --icon-color: white;
    --icon-weight: 600;
    align-items: center;
    justify-content: center;
    width: 24px;
    height: 24px;
    position: absolute;
    right: 0;
    top: 0;
    transform: translate(40%, -40%) scale(0.66);
    transform-origin: center;
    border-radius: 50%;
    background-color: #9c9c9c;
    cursor: pointer;
    display: none;
    opacity: 0.9;
}

.tag-node:hover .tag-node__delete-button {
    display: flex;
}
</style>
