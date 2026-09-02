<script setup lang="ts">
import useAvatarCropper from './use-avatar-cropper'
import type { UserAvatarCropperDialogEmits, UserAvatarCropperDialogProps } from './types'

defineOptions({ name: 'UserAvatarCropperDialog' })
const props = defineProps<UserAvatarCropperDialogProps>()
const emit = defineEmits<UserAvatarCropperDialogEmits>()

const {
    cropperContainerRef,
    imageCanvasRef,
    uploading,
    cropState,
    handleMouseDown,
    handleMouseMove,
    handleMouseUp,
    startResize,
    handleCropAndUpload
} = useAvatarCropper(props, emit)
</script>

<template>
    <nue-dialog
        :model-value="modelValue"
        @update:model-value="(value: boolean) => $emit('update:modelValue', value ?? false)"
        title="裁剪头像"
        theme="loader"
    >
        <template #content>
            <nue-div vertical gap="1rem" align="center">
                <div
                    class="cropper-container"
                    ref="cropperContainerRef"
                    @mousedown="handleMouseDown"
                    @mousemove="handleMouseMove"
                    @mouseup="handleMouseUp"
                    @mouseleave="handleMouseUp"
                >
                    <canvas ref="imageCanvasRef" class="image-canvas" />
                    <div
                        class="crop-overlay"
                        :style="{
                            left: cropState.x + 'px',
                            top: cropState.y + 'px',
                            width: cropState.size + 'px',
                            height: cropState.size + 'px'
                        }"
                    >
                        <div class="crop-border" />
                        <div
                            class="crop-handle corner top-left"
                            @mousedown.stop="startResize('top-left', $event)"
                        />
                        <div
                            class="crop-handle corner top-right"
                            @mousedown.stop="startResize('top-right', $event)"
                        />
                        <div
                            class="crop-handle corner bottom-left"
                            @mousedown.stop="startResize('bottom-left', $event)"
                        />
                        <div
                            class="crop-handle corner bottom-right"
                            @mousedown.stop="startResize('bottom-right', $event)"
                        />
                        <div
                            class="crop-handle edge top"
                            @mousedown.stop="startResize('top', $event)"
                        />
                        <div
                            class="crop-handle edge bottom"
                            @mousedown.stop="startResize('bottom', $event)"
                        />
                        <div
                            class="crop-handle edge left"
                            @mousedown.stop="startResize('left', $event)"
                        />
                        <div
                            class="crop-handle edge right"
                            @mousedown.stop="startResize('right', $event)"
                        />
                    </div>
                </div>
            </nue-div>
        </template>
        <template #footer>
            <nue-button @click="$emit('update:modelValue', false)" theme="ghost">取消</nue-button>
            <nue-button @click="handleCropAndUpload" :loading="uploading" theme="primary">
                确认上传
            </nue-button>
        </template>
    </nue-dialog>
</template>

<style scoped>
.cropper-container {
    position: relative;
    width: 100%;
    height: 400px;
    background: #1a1a1a;
    border-radius: 8px;
    overflow: hidden;
    user-select: none;
}

.image-canvas {
    display: block;
    width: 100%;
    height: 100%;
}

.crop-overlay {
    position: absolute;
    box-shadow: 0 0 0 9999px rgba(0, 0, 0, 0.5);
    cursor: move;
}

.crop-border {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    border: 2px solid #fff;
    box-sizing: border-box;
}

.crop-handle {
    position: absolute;
    width: 12px;
    height: 12px;
    background: #fff;
    border: 2px solid #333;
    border-radius: 50%;
}

.crop-handle.corner {
    z-index: 2;
}

.crop-handle.edge {
    width: 20px;
    height: 8px;
    border-radius: 4px;
}

.crop-handle.top-left {
    top: -6px;
    left: -6px;
    cursor: nwse-resize;
}

.crop-handle.top-right {
    top: -6px;
    right: -6px;
    cursor: nesw-resize;
}

.crop-handle.bottom-left {
    bottom: -6px;
    left: -6px;
    cursor: nesw-resize;
}

.crop-handle.bottom-right {
    bottom: -6px;
    right: -6px;
    cursor: nwse-resize;
}

.crop-handle.top {
    top: -4px;
    left: 50%;
    transform: translateX(-50%);
    cursor: ns-resize;
}

.crop-handle.bottom {
    bottom: -4px;
    left: 50%;
    transform: translateX(-50%);
    cursor: ns-resize;
}

.crop-handle.left {
    left: -4px;
    top: 50%;
    transform: translateY(-50%);
    cursor: ew-resize;
}

.crop-handle.right {
    right: -4px;
    top: 50%;
    transform: translateY(-50%);
    cursor: ew-resize;
}
</style>