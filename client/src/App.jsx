import { Routes, Route } from 'react-router-dom'
import AppLayout from './components/layout/AppLayout.jsx'
import RequireAuth from './components/RequireAuth.jsx'
import DashboardPage from './pages/DashboardPage.jsx'
import DevicesPage from './pages/DevicesPage.jsx'
import DeviceDetailPage from './pages/DeviceDetailPage.jsx'
import DeviceFormPage from './pages/DeviceFormPage.jsx'
import EmployeesPage from './pages/EmployeesPage.jsx'
import EmployeeDetailPage from './pages/EmployeeDetailPage.jsx'
import EmployeeFormPage from './pages/EmployeeFormPage.jsx'
import HandoutsPage from './pages/HandoutsPage.jsx'
import ImportPage from './pages/ImportPage.jsx'
import LoginPage from './pages/LoginPage.jsx'

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route element={<RequireAuth><AppLayout /></RequireAuth>}>
        <Route index element={<DashboardPage />} />
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
      </Route>
      <Route path="*" element={<p className="p-8 text-sm text-slate-600">Page not found.</p>} />
    </Routes>
  )
}
