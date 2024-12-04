<template>
    <nue-div class="tag-node" :class="{ 'tag-node--transparent': tag.color === 'transparent' }">
        <nue-text class="tag-node__name" color="white">{{ tag.name }}</nue-text>
        <nue-text
            v-if="!readonly"
            class="tag-node__delete-button"
            name="clear"
            @click="handleDelete(tag.id)"
        >
            -
        </nue-text>
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
    align-items: center;
    justify-content: center;
    box-sizing: border-box;
    width: auto;
    height: 24px;
    padding: 0 8px;
    background-color: v-bind('tag.color');
    border-radius: 99px;
    position: relative;
    cursor: default;
}

.tag-node__name {
    color: white !important;
    font-size: 12px;
}

.tag-node--transparent {
    border: 1px solid #696969;
}

.tag-node.tag-node--transparent > .tag-node__name {
    color: #696969 !important;
}

.tag-node__delete-button {
    display: flex;
    align-items: center;
    justify-content: center;
    box-sizing: border-box;
    color: white;
    font-size: 24px;
    width: 1px;
    height: 1px;
    padding: 12px;
    position: absolute;
    right: 0;
    transform: scale(0.65) translate(15px, -15px);
    border-radius: 99px;
    background-color: #9c9c9c;
    cursor: pointer;
    opacity: 0;
    transition: opacity 0.16s ease;
}

.tag-node:hover .tag-node__delete-button,
.tag-node__delete-button:hover {
    opacity: 1;
}
</style>
