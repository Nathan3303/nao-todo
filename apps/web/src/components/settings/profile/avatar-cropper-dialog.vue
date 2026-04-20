<template>
    <nue-dialog
        :model-value="modelValue"
        @update:model-value="(value) => $emit('update:modelValue', value ?? false)"
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
                        <div class="crop-handle corner top-left" @mousedown.stop="startResize('top-left', $event)" />
                        <div class="crop-handle corner top-right" @mousedown.stop="startResize('top-right', $event)" />
                        <div class="crop-handle corner bottom-left" @mousedown.stop="startResize('bottom-left', $event)" />
                        <div class="crop-handle corner bottom-right" @mousedown.stop="startResize('bottom-right', $event)" />
                        <div class="crop-handle edge top" @mousedown.stop="startResize('top', $event)" />
                        <div class="crop-handle edge bottom" @mousedown.stop="startResize('bottom', $event)" />
                        <div class="crop-handle edge left" @mousedown.stop="startResize('left', $event)" />
                        <div class="crop-handle edge right" @mousedown.stop="startResize('right', $event)" />
                    </div>
                </div>
            </nue-div>
        </template>
        <template #footer>
            <nue-button @click="$emit('update:modelValue', false)" theme="ghost">取消</nue-button>
            <nue-button @click="handleCropAndUpload" :loading="uploading" theme="primary">确认上传</nue-button>
        </template>
    </nue-dialog>
</template>

<script setup lang="ts">
import { ref, watch, nextTick } from 'vue'
import { NueMessage } from 'nue-ui'
import { unwrapError } from '@nao-todo/infrastructure/utils/go-error-handler'

defineOptions({ name: 'SettingsProfileAvatarCropperDialog' })

interface Props {
    modelValue: boolean
    file: File | null
}
interface Emits {
    (e: 'update:modelValue', value: boolean): void
    (e: 'success', file: File): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

const cropperContainerRef = ref<HTMLDivElement>()
const imageCanvasRef = ref<HTMLCanvasElement>()
const uploading = ref(false)

const image = ref<HTMLImageElement | null>(null)
const minCropSize = 100
const maxCropSize = 400
const containerHeight = 400

const cropState = ref({
    x: 0,
    y: 0,
    size: 200
})

const dragState = ref({
    isDragging: false,
    isResizing: false,
    resizeHandle: '',
    startX: 0,
    startY: 0,
    startCropX: 0,
    startCropY: 0,
    startCropSize: 0
})

const loadImage = (file: File) => {
    const img = new Image()
    img.onload = () => {
        console.log('Image loaded:', img.width, 'x', img.height)
        image.value = img
        initializeAndRender()
    }
    img.onerror = () => {
        NueMessage.error('图片加载失败')
    }
    img.src = URL.createObjectURL(file)
}

const initializeAndRender = async () => {
    for (let i = 0; i < 10; i++) {
        await nextTick()
        if (cropperContainerRef.value && imageCanvasRef.value && image.value) {
            const width = cropperContainerRef.value.clientWidth
            if (width > 0) {
                console.log('Container ready, width:', width)
                renderImage()
                initCropArea()
                return
            }
        }
        await new Promise(resolve => setTimeout(resolve, 50))
    }
    console.log('Container not ready after retries')
}

const renderImage = () => {
    if (!image.value || !imageCanvasRef.value || !cropperContainerRef.value) {
        console.log('renderImage: missing elements')
        return
    }

    const canvas = imageCanvasRef.value
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const containerWidth = cropperContainerRef.value.clientWidth

    canvas.width = containerWidth
    canvas.height = containerHeight

    ctx.fillStyle = '#1a1a1a'
    ctx.fillRect(0, 0, canvas.width, canvas.height)

    const imgRatio = image.value.width / image.value.height
    const containerRatio = containerWidth / containerHeight

    let scale: number
    if (imgRatio > containerRatio) {
        scale = containerWidth / image.value.width
    } else {
        scale = containerHeight / image.value.height
    }

    scale = Math.min(scale, 1)

    const imgWidth = image.value.width * scale
    const imgHeight = image.value.height * scale
    const x = (canvas.width - imgWidth) / 2
    const y = (canvas.height - imgHeight) / 2

    console.log('Rendering:', { imgWidth, imgHeight, x, y, canvasWidth: canvas.width, canvasHeight: canvas.height })
    ctx.drawImage(image.value, x, y, imgWidth, imgHeight)
}

const initCropArea = () => {
    if (!imageCanvasRef.value) return

    const canvas = imageCanvasRef.value
    const size = Math.min(200, Math.min(canvas.width, canvas.height) * 0.8)

    cropState.value = {
        x: (canvas.width - size) / 2,
        y: (canvas.height - size) / 2,
        size: size
    }
}

const handleMouseDown = (e: MouseEvent) => {
    if (!imageCanvasRef.value) return

    const canvas = imageCanvasRef.value
    const rect = canvas.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top

    if (
        x >= cropState.value.x &&
        x <= cropState.value.x + cropState.value.size &&
        y >= cropState.value.y &&
        y <= cropState.value.y + cropState.value.size
    ) {
        dragState.value = {
            isDragging: true,
            isResizing: false,
            resizeHandle: '',
            startX: e.clientX,
            startY: e.clientY,
            startCropX: cropState.value.x,
            startCropY: cropState.value.y,
            startCropSize: cropState.value.size
        }
    }
}

const handleMouseMove = (e: MouseEvent) => {
    if (!imageCanvasRef.value) return

    if (dragState.value.isDragging) {
        const dx = e.clientX - dragState.value.startX
        const dy = e.clientY - dragState.value.startY

        cropState.value.x = dragState.value.startCropX + dx
        cropState.value.y = dragState.value.startCropY + dy
    } else if (dragState.value.isResizing) {
        handleResizeMove(e)
    }
}

const handleMouseUp = () => {
    dragState.value.isDragging = false
    dragState.value.isResizing = false
}

const startResize = (handle: string, e: MouseEvent) => {
    dragState.value = {
        isDragging: false,
        isResizing: true,
        resizeHandle: handle,
        startX: e.clientX,
        startY: e.clientY,
        startCropX: cropState.value.x,
        startCropY: cropState.value.y,
        startCropSize: cropState.value.size
    }
}

const handleResizeMove = (e: MouseEvent) => {
    const dx = e.clientX - dragState.value.startX
    const dy = e.clientY - dragState.value.startY
    const handle = dragState.value.resizeHandle

    let newSize = dragState.value.startCropSize
    let newX = dragState.value.startCropX
    let newY = dragState.value.startCropY

    switch (handle) {
        case 'top-left':
            newSize = dragState.value.startCropSize - dx
            newX = dragState.value.startCropX + dx
            newY = dragState.value.startCropY + dy
            break
        case 'top-right':
            newSize = dragState.value.startCropSize + dx
            newY = dragState.value.startCropY + dy
            break
        case 'bottom-left':
            newSize = dragState.value.startCropSize - dx
            newX = dragState.value.startCropX + dx
            break
        case 'bottom-right':
            newSize = dragState.value.startCropSize + dx
            break
        case 'top':
            newSize = dragState.value.startCropSize - dy
            newY = dragState.value.startCropY + dy
            break
        case 'bottom':
            newSize = dragState.value.startCropSize + dy
            break
        case 'left':
            newSize = dragState.value.startCropSize - dx
            newX = dragState.value.startCropX + dx
            break
        case 'right':
            newSize = dragState.value.startCropSize + dx
            break
    }

    newSize = Math.max(minCropSize, Math.min(maxCropSize, newSize))
    cropState.value = { x: newX, y: newY, size: newSize }
}

const handleCropAndUpload = async () => {
    if (!image.value || !imageCanvasRef.value || !cropperContainerRef.value) return

    uploading.value = true
    try {
        const canvas = imageCanvasRef.value
        const container = cropperContainerRef.value
        const ctx = canvas.getContext('2d')
        if (!ctx) {
            NueMessage.error('裁剪失败')
            return
        }

        const tempCanvas = document.createElement('canvas')
        const tempCtx = tempCanvas.getContext('2d')
        if (!tempCtx) {
            NueMessage.error('裁剪失败')
            return
        }

        tempCanvas.width = cropState.value.size
        tempCanvas.height = cropState.value.size

        const containerWidth = container.clientWidth
        const imgRatio = image.value.width / image.value.height
        const containerRatio = containerWidth / containerHeight

        let scale: number
        if (imgRatio > containerRatio) {
            scale = containerWidth / image.value.width
        } else {
            scale = containerHeight / image.value.height
        }
        scale = Math.min(scale, 1)

        const imgWidth = image.value.width * scale
        const imgHeight = image.value.height * scale
        const imgX = (canvas.width - imgWidth) / 2
        const imgY = (canvas.height - imgHeight) / 2

        const cropXInImg = (cropState.value.x - imgX) / scale
        const cropYInImg = (cropState.value.y - imgY) / scale
        const cropSizeInImg = cropState.value.size / scale

        tempCtx.drawImage(
            image.value,
            Math.max(0, cropXInImg),
            Math.max(0, cropYInImg),
            Math.max(1, cropSizeInImg),
            Math.max(1, cropSizeInImg),
            0,
            0,
            cropState.value.size,
            cropState.value.size
        )

        const blob = await new Promise<Blob | null>((resolve) => {
            tempCanvas.toBlob((blob) => resolve(blob), 'image/png')
        })

        if (!blob) {
            NueMessage.error('裁剪失败')
            return
        }

        const file = new File([blob], 'avatar.png', { type: 'image/png' })

        emit('success', file)
        emit('update:modelValue', false)
    } catch (err) {
        NueMessage.error('上传失败: ' + unwrapError(err as any))
    } finally {
        uploading.value = false
    }
}

watch(
    () => props.modelValue,
    (newVal) => {
        if (newVal && props.file) {
            loadImage(props.file)
        }
    }
)

watch(
    () => props.file,
    (newFile) => {
        if (newFile && props.modelValue) {
            loadImage(newFile)
        }
    }
)
</script>

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

