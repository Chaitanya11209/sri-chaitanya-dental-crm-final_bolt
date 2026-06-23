import { createRoot } from "react-dom/client";
import { Router as WouterRouter, Switch, Route, Redirect } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import LandingApp from "./App";
import AdminLogin from "./pages/AdminLogin";
import ResetPassword from "./pages/ResetPassword";
import CRMLayout from "./pages/crm/CRMLayout";
import CRMDashboard from "./pages/crm/Dashboard";
import Patients from "./pages/crm/Patients";
import Appointments from "./pages/crm/Appointments";
import Treatments from "./pages/crm/Treatments";
import Billing from "./pages/crm/Billing";
import Collections from "./pages/crm/Collections";
import Followups from "./pages/crm/Followups";
import Users from "./pages/crm/Users";
import Analytics from "./pages/crm/Analytics";
import Reports from "./pages/crm/Reports";
import Export from "./pages/crm/Export";
import Settings from "./pages/crm/Settings";
import Doctors from "./pages/crm/Doctors";
import AuditLogs from "./pages/crm/AuditLogs";
import LabWork from "./pages/crm/LabWork";
import Letters from "./pages/crm/Letters";
import Expenses from "./pages/crm/Expenses";
import Inventory from "./pages/crm/Inventory";
import Profile from "./pages/crm/Profile";
import Setup from "./pages/crm/Setup";
import ThreeDModel from "./pages/crm/ThreeDModel";
import PatientPortal from "./pages/PatientPortal";
import QueueDisplay from "./pages/QueueDisplay";
import ErrorBoundary from "./components/ErrorBoundary";
import RoleGuard from "./components/RoleGuard";
import { NotificationProvider } from "./components/NotificationProvider";
import { AppointmentsProvider } from "./components/AppointmentsContext";
import { isAdmin, isDoctor, getRole, hasAccessToRoute } from "./lib/auth";
import "./index.css";

const queryClient = new QueryClient();

function AdminRoute({ path, component: Component }: { path: string; component: React.ComponentType<any> }) {
  const role = getRole();
  const authorized = hasAccessToRoute(path, role);
  return (
    <Route path={path}>
      {authorized ? <Component /> : <Redirect to="/crm/dashboard" />}
    </Route>
  );
}

function AdminOnlyRoute({ path, component: Component }: { path: string; component: React.ComponentType<any> }) {
  const role = getRole();
  const authorized = hasAccessToRoute(path, role);
  return (
    <Route path={path}>
      {authorized ? <Component /> : <Redirect to="/crm/dashboard" />}
    </Route>
  );
}

function CRMRoutes() {
  return (
    <CRMLayout>
      <Switch>
        <Route path="/crm/dashboard" component={CRMDashboard} />
        <Route path="/crm/patients" component={Patients} />
        <Route path="/crm/appointments" component={Appointments} />
        <Route path="/crm/treatments" component={Treatments} />
        <Route path="/crm/doctors" component={Doctors} />
        <AdminRoute path="/crm/reports" component={Reports} />
        <AdminRoute path="/crm/billing" component={Billing} />
        <AdminRoute path="/crm/collections" component={Collections} />
        <Route path="/crm/followups" component={Followups} />
        <AdminRoute path="/crm/users" component={Users} />
        <AdminOnlyRoute path="/crm/export" component={Export} />
        <AdminOnlyRoute path="/crm/audit" component={AuditLogs} />
        <AdminRoute path="/crm/settings" component={Settings} />
        <Route path="/crm/labwork" component={LabWork} />
        <Route path="/crm/letters" component={Letters} />
        <AdminRoute path="/crm/expenses" component={Expenses} />
        <Route path="/crm/inventory" component={Inventory} />
        <Route path="/crm/profile" component={Profile} />
        <Route path="/crm/3d-model" component={ThreeDModel} />
        <AdminRoute path="/crm/setup" component={Setup} />
        <Route>
          <Redirect to="/crm/dashboard" />
        </Route>
      </Switch>
    </CRMLayout>
  );
}

function AppRouter() {
  const base = (import.meta.env.BASE_URL ?? "/").replace(/\/$/, "");
  return (
    <QueryClientProvider client={queryClient}>
      <WouterRouter base={base}>
        <Switch>
          {/* Legacy /dashboard redirect → new CRM */}
          <Route path="/dashboard">
            <Redirect to="/crm/dashboard" />
          </Route>
          <Route path="/admin" component={AdminLogin} />
          <Route path="/reset-password" component={ResetPassword} />
          <Route path="/patient-portal" component={PatientPortal} />
          <Route path="/queue-display" component={QueueDisplay} />
          <Route path="/crm/:rest*">
            <RoleGuard>
              <CRMRoutes />
            </RoleGuard>
          </Route>
          <Route path="/" component={LandingApp} />
        </Switch>
      </WouterRouter>
    </QueryClientProvider>
  );
}

createRoot(document.getElementById("root")!).render(
  <ErrorBoundary>
    <NotificationProvider>
      <AppointmentsProvider>
        <AppRouter />
      </AppointmentsProvider>
    </NotificationProvider>
  </ErrorBoundary>
);

// Register Service Worker for Offline clinical tracking
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then((reg) => {
        console.log('[Service Worker] Registered successfully with scope:', reg.scope);
      })
      .catch((err) => {
        console.warn('[Service Worker] Registration failed:', err);
      });
  });
}

