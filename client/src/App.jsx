import { Routes, Route, Outlet } from 'react-router-dom'
import AppLayout from './components/layout/AppLayout.jsx'
import RequireAuth from './components/RequireAuth.jsx'
import RequireRole from './components/RequireRole.jsx'
import HomeRoute from './components/HomeRoute.jsx'
import DevicesPage from './pages/DevicesPage.jsx'
import DeviceDetailPage from './pages/DeviceDetailPage.jsx'
import DeviceFormPage from './pages/DeviceFormPage.jsx'
import EmployeesPage from './pages/EmployeesPage.jsx'
import EmployeeDetailPage from './pages/EmployeeDetailPage.jsx'
import EmployeeFormPage from './pages/EmployeeFormPage.jsx'
import HandoutsPage from './pages/HandoutsPage.jsx'
import ImportPage from './pages/ImportPage.jsx'
import LoginPage from './pages/LoginPage.jsx'
import SessionsPage from './pages/SessionsPage.jsx'
import SessionDetailPage from './pages/SessionDetailPage.jsx'
import PrintLabelsPage from './pages/PrintLabelsPage.jsx'
import InventoryPage from './pages/InventoryPage.jsx'
import UsersPage from './pages/UsersPage.jsx'
import RegisterPage from './pages/RegisterPage.jsx'
import DepartmentsPage from './pages/DepartmentsPage.jsx'
import ArchivePage from './pages/ArchivePage.jsx'
import { CUSTODY_ROLES } from './lib/roles.js'

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route element={<RequireAuth><AppLayout /></RequireAuth>}>
        <Route index element={<HomeRoute />} />
        <Route path="sessions" element={<SessionsPage />} />
        <Route path="sessions/:id" element={<SessionDetailPage />} />

        <Route element={<RequireRole roles={CUSTODY_ROLES}><Outlet /></RequireRole>}>
          {/* /devices/new must precede /devices/:id or it is swallowed by it. */}
          <Route path="devices" element={<DevicesPage />} />
          <Route path="devices/new" element={<DeviceFormPage />} />
          <Route path="devices/:id/edit" element={<DeviceFormPage />} />
          <Route path="devices/:id" element={<DeviceDetailPage />} />
          <Route path="employees" element={<EmployeesPage />} />
          <Route path="employees/new" element={<EmployeeFormPage />} />
          <Route path="employees/:id/edit" element={<EmployeeFormPage />} />
          <Route path="employees/:id" element={<EmployeeDetailPage />} />
          <Route path="handouts" element={<HandoutsPage />} />
          <Route path="import" element={<ImportPage />} />
          <Route path="inventory" element={<InventoryPage />} />
        </Route>

        <Route element={<RequireRole roles={['admin']}><Outlet /></RequireRole>}>
          {/* /users/register must precede /users/:id-shaped routes if any are added later. */}
          <Route path="users" element={<UsersPage />} />
          <Route path="users/register" element={<RegisterPage />} />
          <Route path="departments" element={<DepartmentsPage />} />
          <Route path="archive" element={<ArchivePage />} />
          <Route path="sessions/:id/labels" element={<PrintLabelsPage />} />
        </Route>
      </Route>
      <Route path="*" element={<p className="p-8 text-sm text-slate-600">Page not found.</p>} />
    </Routes>
  )
}
