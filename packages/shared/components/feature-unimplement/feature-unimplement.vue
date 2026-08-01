<script setup lang="ts">
defineOptions({ name: 'FeatureUnimplement' })
const emit = defineEmits(['back'])
</script>

<template>
    <nue-empty
        image-src="/images/feature.webp"
        image-size="8rem"
        description="页面还在规划中，敬请期待"
        style="height: 100%"
    >
        <nue-button theme="small,primary" @click="emit('back')">返回</nue-button>
    </nue-empty>
</template>

<style scoped></style>