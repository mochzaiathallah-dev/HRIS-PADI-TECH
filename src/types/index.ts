export type UserRole = 'owner' | 'tutor' | 'host'

export interface UserProfile {
  id: string
  nama: string
  role: UserRole
  created_at?: string
  updated_at?: string
}

export interface Murid {
  id: string
  nama: string
  tingkat_kelas: string
  created_at?: string
}

export interface LaporanBimbel {
  id: string
  tutor_id: string
  murid_id: string
  tanggal: string
  mata_pelajaran: string
  topik: string
  ringkasan: string
  created_at?: string
  // Join properties
  tutor?: {
    nama: string
  }
  murid?: {
    nama: string
    tingkat_kelas: string
  }
}

export interface LaporanTiktok {
  id: string
  host_id: string
  tanggal: string
  durasi_menit: number
  gmv_rupiah: number
  tayangan: number
  impresi: number
  foto_bukti_url?: string | null
  created_at?: string
  // Join properties
  host?: {
    nama: string
  }
}

export interface AuthState {
  user: any | null
  profile: UserProfile | null
  role: UserRole | null
  isLoading: boolean
  isAuthenticated: boolean
}
