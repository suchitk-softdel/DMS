import { ROLES } from '@/constants/roles'

// Demo account for mock mode. The password lives here only because mock mode
// has no backend; it is shipped in the client bundle and must never be real.
export const users = [
  {
    id: 'u-002',
    name: 'Daniel Morgan',
    email: 'dealer@demo.com',
    password: 'demo123',
    roleId: ROLES.DEALER,
    dealerId: 'd-1001',
  },
]
