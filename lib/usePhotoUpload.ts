import { useRef, useState } from 'react'
import { Alert } from 'react-native'
import * as ImagePicker from 'expo-image-picker'
import { useTranslation } from 'react-i18next'
import { supabase } from '@/lib/supabase'
import { photoPayload } from '@/lib/photoPayload'

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
  const { t } = useTranslation()
  const [uploading, setUploading] = useState(false)
  const inFlight = useRef(false)

  const upload = async (options: UploadOptions = {}): Promise<string | null> => {
    const { folder = 'general', quality = 0.75, allowsEditing = true } = options

    if (inFlight.current) return null
    inFlight.current = true
    setUploading(true)
    try {
      // The system image picker grants access to the selected image. Broad library
      // permission is unnecessary for this image-only flow.
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing,
        quality,
        base64: true,
      })
      if (result.canceled || !result.assets[0]) return null
      const base64 = result.assets[0].base64
      if (!base64) throw new Error('The picker did not return photo data')
      const { body, contentType, extension } = photoPayload(base64)
      const filename = `${folder}/${Date.now()}-${Math.random().toString(36).slice(2)}.${extension}`

      const { error } = await supabase.storage
        .from('photos')
        .upload(filename, body, { contentType, upsert: false })

      if (error) throw error

      // Return the permanent public URL
      const { data } = supabase.storage.from('photos').getPublicUrl(filename)
      return data.publicUrl
    } catch {
      Alert.alert(t('common.error'), t('media.upload_error'))
      console.warn('Photo upload failed')
      return null
    } finally {
      setUploading(false)
      inFlight.current = false
    }
  }

  return { upload, uploading }
}
