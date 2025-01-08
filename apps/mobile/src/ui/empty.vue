<template>
    <view class="nuem-empty">
        <image :src="imageSrc" class="nuem-empty__image" />
        <text v-if="description" class="nuem-empty__description">{{ description }}</text>
    </view>
</template>

<script lang="ts" setup>
import EmptyImage from './empty.png'

defineOptions({ name: 'NuemEmpty' })
withDefaults(
    defineProps<{
        imageSrc?: string
        description?: string
    }>(),
    {
        imageSrc: EmptyImage,
        description: '暂无内容'
    }
)
</script>

<style scoped>
.nuem-empty {
    --image-size: 64px;
}

.nuem-empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    font-weight: normal;
    flex: auto;
}

.nuem-empty__image {
    aspect-ratio: 1;
    width: var(--image-size);
    height: var(--image-size);
    object-fit: contain;
    margin-bottom: 16px;
    border-radius: var(--primary-radius);
}

.nuem-empty__description {
    font-size: var(--text-sm);
    color: var(--secondary-text-color);
}
</style>
