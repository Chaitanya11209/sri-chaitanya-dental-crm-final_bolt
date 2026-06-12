import { createRoot } from "react-dom/client";
import { Router as WouterRouter, Switch, Route, Redirect } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import LandingApp from "./App";
import AdminLogin from "./pages/AdminLogin";
import CRMLayout from "./pages/crm/CRMLayout";
import CRMDashboard from "./pages/crm/Dashboard";
import Patients from "./pages/crm/Patients";
import Appointments from "./pages/crm/Appointments";
import Treatments from "./pages/crm/Treatments";
import Billing from "./pages/crm/Billing";
import Collections from "./pages/crm/Collections";
import Followups from "./pages/crm/Followups";
import Users from "./pages/crm/Users";
import Permissions from "./pages/crm/Permissions";
import Analytics from "./pages/crm/Analytics";
import Export from "./pages/crm/Export";
import Settings from "./pages/crm/Settings";
import Doctors from "./pages/crm/Doctors";
import ErrorBoundary from "./components/ErrorBoundary";
import { NotificationProvider } from "./components/NotificationProvider";
import { isAdmin, isDoctor } from "./lib/auth";
import "./index.css";

const queryClient = new QueryClient();

function AdminRoute({ path, component: Component }: { path: string; component: React.ComponentType<any> }) {
  const authorized = isAdmin() || isDoctor();
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
        <Route path="/crm/reports" component={Analytics} />
        <Route path="/crm/billing" component={Billing} />
        <Route path="/crm/collections" component={Collections} />
        <Route path="/crm/followups" component={Followups} />
        <Route path="/crm/users" component={Users} />
        <Route path="/crm/permissions" component={Permissions} />
        <Route path="/crm/export" component={Export} />
        <Route path="/crm/settings" component={Settings} />
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
          <Route path="/crm/:rest*" component={CRMRoutes} />
          <Route path="/" component={LandingApp} />
        </Switch>
      </WouterRouter>
    </QueryClientProvider>
  );
}

createRoot(document.getElementById("root")!).render(
  <ErrorBoundary>
    <NotificationProvider>
      <AppRouter />
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

