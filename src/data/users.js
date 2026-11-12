import { ROLES } from '@/constants/roles'

// Demo accounts. Passwords live here only because there is no backend yet;
// they are shipped in the client bundle and must never be real credentials.
export const users = [
  {
    id: 'u-001',
    name: 'Demo Administrator',
    email: 'admin@demo.com',
    password: 'demo123',
    roleId: ROLES.ADMIN,
    dealerId: null,
  },
  {
    id: 'u-005',
    name: 'Demo Manufacturer',
    email: 'manufacturer@demo.com',
    password: 'demo123',
    roleId: ROLES.MANUFACTURER,
    dealerId: null,
  },
  {
    id: 'u-002',
    name: 'Demo Principal',
    email: 'principal@demo.com',
    password: 'demo123',
    roleId: ROLES.PRINCIPAL,
    dealerId: 'd-1001',
  },
  {
    id: 'u-003',
    name: 'Demo Sales Rep',
    email: 'sales@demo.com',
    password: 'demo123',
    roleId: ROLES.SALES_REP,
    dealerId: 'd-1001',
  },
  {
    id: 'u-004',
    name: 'Demo Technician',
    email: 'tech@demo.com',
    password: 'demo123',
    roleId: ROLES.TECHNICIAN,
    dealerId: 'd-1001',
  },
]
