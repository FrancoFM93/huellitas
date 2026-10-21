import { create } from 'zustand'
import { supabase } from '@/lib/supabase'
import { createNotificationState } from '@/store/notificationState'

export const useNotificationStore = create(createNotificationState(supabase))
