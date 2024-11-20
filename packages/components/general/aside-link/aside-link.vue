<template>
    <nue-link
        theme="btnlike,plink"
        :route="routeName ? { name: routeName } : void 0"
        v-bind="$attrs"
    >
        <slot />
        <template #append>
            <slot name="append" />
        </template>
    </nue-link>
</template>

<script setup lang="ts">
defineOptions({ name: 'AsideLink' })
defineProps<{ routeName?: string }>()
</script>

<style scoped>
.nue-link--plink {
    overflow: hidden;

    .nue-icon {
        line-height: 1;
        display: flex;
        align-items: center;
        --font-size: 16px;
    }

    & span {
        width: 100%;
        text-align: left;
        font-size: var(--text-xs);
    }
}
</style>
