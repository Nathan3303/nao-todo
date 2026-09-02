import { GoError, unwrapError } from '@nao-todo/shared'
import { NueMessage } from 'nue-ui'
import { nextTick, ref, watch } from 'vue'
import type { UserAvatarCropperDialogEmits, UserAvatarCropperDialogProps } from './types'

const minCropSize = 100
const maxCropSize = 400
const containerHeight = 400

/**
 * 头像裁剪逻辑
 * @description 收敛图片加载/渲染/裁剪框拖拽缩放/裁剪上传的全部状态与 handler；
 *              组件只保留模板与装配（200 行抽离规则）。
 * @param props 对话框属性
 * @param emit 对话框事件
 */
const useAvatarCropper = (
    props: UserAvatarCropperDialogProps,
    emit: UserAvatarCropperDialogEmits
) => {
    const cropperContainerRef = ref<HTMLDivElement>()
    const imageCanvasRef = ref<HTMLCanvasElement>()
    const uploading = ref(false)

    const image = ref<HTMLImageElement | null>(null)

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
            image.value = img
            void initializeAndRender()
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
                    renderImage()
                    initCropArea()
                    return
                }
            }
            await new Promise((resolve) => setTimeout(resolve, 50))
        }
    }

    const renderImage = () => {
        if (!image.value || !imageCanvasRef.value || !cropperContainerRef.value) return

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
            NueMessage.error('上传失败: ' + unwrapError(err as GoError))
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

    return {
        cropperContainerRef,
        imageCanvasRef,
        uploading,
        cropState,
        handleMouseDown,
        handleMouseMove,
        handleMouseUp,
        startResize,
        handleCropAndUpload
    }
}

export default useAvatarCropper