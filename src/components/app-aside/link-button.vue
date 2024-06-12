<template>
    <nue-link :theme="['btnlike', 'navlink']" :icon="iconName" v-bind="$attrs">
        <nue-text class="link-text">
            <slot></slot>
        </nue-text>
        <template #append>
            <nue-icon name="more" class="link-more" @click.stop="handleClick" />
        </template>
    </nue-link>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'

defineOptions({ name: 'LinkButton' })

const props = withDefaults(defineProps<{ icon?: string }>(), { icon: 'more2' })

const iconName = computed(() => `icon-${props.icon}`)

function handleClick(e: MouseEvent) {
    // const target = e.target as HTMLElement
    // console.dir(target)
    // const menuX = target.offsetLeft
    // const menuY = target.offsetTop + target.offsetHeight
    // moreMenuRef.value.showMenu(menuX, menuY)
}
</script>

<style scoped>
.nue-link {
    position: relative;
    &:hover {
        & .link-more {
            opacity: 1;
        }
    }
}

.link-text {
    margin-right: auto;
}

.link-more {
    opacity: 0;
    padding: 2px;

    &:hover {
        background-color: #f2f2f2;
        border-radius: 5px;
    }
}
</style>
