<template>
    <nue-link theme="btnlike,plink" :route="route" v-bind="$attrs">
        <slot />
        <template #append>
            <slot name="append" />
        </template>
    </nue-link>
</template>

<script setup lang="ts">
import { computed } from 'vue'

defineOptions({ name: 'AsideLink' })
const props = defineProps<{ routeName?: string }>()

const route = computed(() => {
    const { routeName } = props
    return routeName ? { name: routeName } : undefined
})
</script>
