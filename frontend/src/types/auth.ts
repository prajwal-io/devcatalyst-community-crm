export type UserRole = 'ADMIN' | 'PARTICIPANT'

export interface UserProfile {
  id: string
  full_name: string
  email: string
  role: UserRole
}
