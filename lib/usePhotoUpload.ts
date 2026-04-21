import { useState } from 'react'
import { Alert } from 'react-native'
import * as ImagePicker from 'expo-image-picker'
import { supabase } from '@/lib/supabase'

interface UploadOptions {
  /** Storage subfolder, e.g. 'avatars' or 'pets'. Defaults to 'general'. */
  folder?: string
  /** Image quality 0–1. Defaults to 0.75. */
  quality?: number
  /** Allow cropping the image before upload. Defaults to true. */
  allowsEditing?: boolean
}

/**
 * Hook for picking an image from the device gallery and uploading it
 * to the Supabase Storage 'photos' bucket.
 *
 * Usage:
 *   const { upload, uploading } = usePhotoUpload()
 *   const url = await upload({ folder: 'avatars' })
 *
 * Returns the public URL of the uploaded file, or null if cancelled / failed.
 */
export function usePhotoUpload() {
  const [uploading, setUploading] = useState(false)

  const upload = async (options: UploadOptions = {}): Promise<string | null> => {
    const { folder = 'general', quality = 0.75, allowsEditing = true } = options

    // Ask for gallery permission
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (status !== 'granted') {
      Alert.alert('Permiso denegado', 'Necesitamos acceso a tu galería para subir fotos.')
      return null
    }

    // Open picker
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing,
      quality,
    })

    if (result.canceled || !result.assets[0]) return null

    const asset = result.assets[0]

    setUploading(true)
    try {
      // Use fetch to read the local URI as a Blob (standard approach in React Native)
      const response = await fetch(asset.uri)
      const blob = await response.blob()

      // Build a unique path: folder/timestamp-random.ext
      const ext = asset.uri.split('.').pop()?.toLowerCase() ?? 'jpg'
      const filename = `${folder}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
      const contentType = ext === 'png' ? 'image/png' : 'image/jpeg'

      const { error } = await supabase.storage
        .from('photos')
        .upload(filename, blob, { contentType, upsert: false })

      if (error) throw error

      // Return the permanent public URL
      const { data } = supabase.storage.from('photos').getPublicUrl(filename)
      return data.publicUrl
    } catch (e) {
      Alert.alert('Error', 'No se pudo subir la foto. Intentá de nuevo.')
      console.error('usePhotoUpload error:', e)
      return null
    } finally {
      setUploading(false)
    }
  }

  return { upload, uploading }
}
