import imageCompression from 'browser-image-compression'

export interface CompressionResult {
  file: File
  previewUrl: string
  originalSizeKB: number
  compressedSizeKB: number
  ratioPercent: number
}

export async function compressClientImage(
  imageFile: File,
  maxSizeMB: number = 0.35,
  maxWidthOrHeight: number = 1280
): Promise<CompressionResult> {
  const originalSizeKB = Math.round(imageFile.size / 1024)

  const options = {
    maxSizeMB,
    maxWidthOrHeight,
    useWebWorker: true,
    fileType: 'image/webp',
    initialQuality: 0.8,
  }

  try {
    const compressedBlob = await imageCompression(imageFile, options)
    
    // Convert Blob back to File with webp extension
    const baseName = imageFile.name.replace(/\.[^/.]+$/, '')
    const compressedFile = new File([compressedBlob], `${baseName}.webp`, {
      type: 'image/webp',
      lastModified: Date.now(),
    })

    const compressedSizeKB = Math.round(compressedFile.size / 1024)
    const ratioPercent = originalSizeKB > 0 
      ? Math.max(0, Math.round(((originalSizeKB - compressedSizeKB) / originalSizeKB) * 100))
      : 0

    const previewUrl = URL.createObjectURL(compressedFile)

    return {
      file: compressedFile,
      previewUrl,
      originalSizeKB,
      compressedSizeKB,
      ratioPercent,
    }
  } catch (error) {
    console.warn('Image compression failed, using original file fallback:', error)
    return {
      file: imageFile,
      previewUrl: URL.createObjectURL(imageFile),
      originalSizeKB,
      compressedSizeKB: originalSizeKB,
      ratioPercent: 0,
    }
  }
}

export function formatFileSize(kb: number): string {
  if (kb >= 1024) {
    return `${(kb / 1024).toFixed(2)} MB`
  }
  return `${kb} KB`
}
