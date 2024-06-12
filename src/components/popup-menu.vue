<template>
    <div v-if="visible" class="popup-menu-wrapper" @click.stop.prevent="() => {}">
        <div class="popup-menu" :style="menuStyle">
            <p>menu-item</p>
            <p>menu-item</p>
        </div>
    </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'

defineOptions({ name: 'PopupMenu' })

const visible = ref(false)
const menuX = ref(0)
const menuY = ref(0)

const menuStyle = computed(() => {
    return {
        left: `${menuX.value}px`,
        top: `${menuY.value}px`
    }
})

function showMenu(x: number, y: number) {
    menuX.value = x
    menuY.value = y
    visible.value = true
    document.addEventListener('click', hideMenu, true)
}

function hideMenu() {
    visible.value = false
    document.removeEventListener('click', hideMenu, true)
}

defineExpose({ showMenu })
</script>

<style scoped>
.popup-menu-wrapper {
    position: relative;
}

.popup-menu {
    position: absolute;
    width: 128px;
    height: 256px;
    background-color: white;
    box-shadow: 0px 0px 3px 1px #f3f3f3;
    z-index: 1;
    border-radius: 6px;
    padding: 4px;
    overflow: hidden;
}
</style>
