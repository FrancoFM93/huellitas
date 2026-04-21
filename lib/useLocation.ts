import { useState } from 'react'
import { Alert } from 'react-native'
import * as Location from 'expo-location'

export interface LocationResult {
  lat: number
  lng: number
  address: string
}

/**
 * Hook for getting the device's current GPS position.
 *
 * Usage:
 *   const { getLocation, locating } = useLocation()
 *   const loc = await getLocation()
 *   // loc = { lat, lng, address } or null if denied/failed
 *
 * Handles permission request, GPS fetch, and reverse geocoding internally.
 */
export function useLocation() {
  const [locating, setLocating] = useState(false)

  const getLocation = async (): Promise<LocationResult | null> => {
    // Ask for foreground location permission
    const { status } = await Location.requestForegroundPermissionsAsync()
    if (status !== 'granted') {
      Alert.alert('Permiso denegado', 'Activá el permiso de ubicación para usar esta función.')
      return null
    }

    setLocating(true)
    try {
      const pos = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced, // good enough for mapping, faster than High
      })

      const { latitude: lat, longitude: lng } = pos.coords

      // Reverse geocode: coords → human-readable address
      const [geo] = await Location.reverseGeocodeAsync({ latitude: lat, longitude: lng })

      // Build the address string from whatever fields are available
      const streetPart = [geo.street, geo.streetNumber].filter(Boolean).join(' ')
      const cityPart = geo.city ?? geo.subregion ?? geo.region ?? ''
      const address = [streetPart, cityPart].filter(Boolean).join(', ')
        || `${lat.toFixed(5)}, ${lng.toFixed(5)}` // fallback to raw coords

      return { lat, lng, address }
    } catch {
      Alert.alert('Error', 'No se pudo obtener tu ubicación. Intentá de nuevo.')
      return null
    } finally {
      setLocating(false)
    }
  }

  return { getLocation, locating }
}
