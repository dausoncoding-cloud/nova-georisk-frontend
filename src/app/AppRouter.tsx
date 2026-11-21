import { lazy, Suspense } from "react";
import { Outlet, Route, Routes } from "react-router-dom";
import { RequireSession } from "../features/auth/RequireSession";
import { LoginPage } from "../features/auth/LoginPage";
import { OrganizationContextProvider } from "../features/organization/OrganizationContext";
import { AuthenticatedLayout } from "./AuthenticatedLayout";
import { NotFoundPage } from "./NotFoundPage";
import { RedirectTo } from "./RedirectTo";
import { SuiteHomePage } from "./SuiteHomePage";
import { FRRIS_ROUTES } from "./routes";

const ProjectListPage = lazy(() => import("../features/projects/ProjectListPage").then((module) => ({ default: module.ProjectListPage })));
const ProjectDetailPage = lazy(() => import("../features/projects/ProjectDetailPage").then((module) => ({ default: module.ProjectDetailPage })));
const ProjectFormPage = lazy(() => import("../features/projects/ProjectFormPage").then((module) => ({ default: module.ProjectFormPage })));
const AoiListPage = lazy(() => import("../features/aois/AoiListPage").then((module) => ({ default: module.AoiListPage })));
const AnalysisSubmitPage = lazy(() => import("../features/analyses/AnalysisSubmitPage").then((module) => ({ default: module.AnalysisSubmitPage })));
const TaskDetailPage = lazy(() => import("../features/tasks/TaskDetailPage").then((module) => ({ default: module.TaskDetailPage })));
const AnalysesListPage = lazy(() => import("../features/analyses/AnalysesListPage").then((module) => ({ default: module.AnalysesListPage })));
const AreaPlaygroundPage = lazy(() => import("../features/playground/AreaPlaygroundPage").then((module) => ({ default: module.AreaPlaygroundPage })));
const TaskListPage = lazy(() => import("../features/tasks/TaskListPage").then((module) => ({ default: module.TaskListPage })));
const ResultDetailPage = lazy(() => import("../features/results/ResultDetailPage").then((module) => ({ default: module.ResultDetailPage })));
const ResultListPage = lazy(() => import("../features/results/ResultListPage").then((module) => ({ default: module.ResultListPage })));
const DashboardPage = lazy(() => import("../features/dashboard/DashboardPage").then((module) => ({ default: module.DashboardPage })));
const ProjectWorkspaceLayout = lazy(() => import("../features/projects/ProjectWorkspaceLayout").then((module) => ({ default: module.ProjectWorkspaceLayout })));
const DataCatalogPage = lazy(() => import("../features/data/DataCatalogPage").then((module) => ({ default: module.DataCatalogPage })));
const ProjectUtilityPage = lazy(() => import("../features/projects/ProjectUtilityPage").then((module) => ({ default: module.ProjectUtilityPage })));
const SettingsPage = lazy(() => import("../features/settings/SettingsPage").then((module) => ({ default: module.SettingsPage })));
const PortfolioCapabilityPage = lazy(() => import("../features/projects/PortfolioCapabilityPage").then((module) => ({ default: module.PortfolioCapabilityPage })));

const AdministrationPage = lazy(() => import("../features/management/AdministrationPage").then(m => ({ default: m.AdministrationPage })));
const PlatformAdminLayout = lazy(() => import("../features/platformAdmin/PlatformAdminLayout").then(m => ({ default: m.PlatformAdminLayout })));
const CustomersPage = lazy(() => import("../features/platformAdmin/CustomersPage").then(m => ({ default: m.CustomersPage })));
const PaymentsPage = lazy(() => import("../features/platformAdmin/ConsolePages").then(m => ({ default: m.PaymentsPage })));
const PlansPage = lazy(() => import("../features/platformAdmin/ConsolePages").then(m => ({ default: m.PlansPage })));
const SecurityAlertsPage = lazy(() => import("../features/platformAdmin/ConsolePages").then(m => ({ default: m.SecurityAlertsPage })));
const IntegrationsPage = lazy(() => import("../features/platformAdmin/IntegrationsPage").then(m => ({ default: m.IntegrationsPage })));
const AuditLogPage = lazy(() => import("../features/platformAdmin/ConsolePages").then(m => ({ default: m.AuditLogPage })));
const SubscriptionPage = lazy(() => import("../features/subscription/SubscriptionPage").then(m => ({ default: m.SubscriptionPage })));
const ExternalDataPage = lazy(() => import("../features/management/ExternalDataPage").then(m => ({ default: m.ExternalDataPage })));

export function AppRouter() {
  return (
    <Suspense fallback={<main className="page-shell"><p>Loading NOVA workspace…</p></main>}>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route element={<RequireSession />}>
          {/* Subscriptions M4: NOVA ARI console; the API allows platform admins only. */}
          <Route path="nova-ari" element={<PlatformAdminLayout />}>
            <Route index element={<CustomersPage />} />
            <Route path="payments" element={<PaymentsPage />} />
            <Route path="plans" element={<PlansPage />} />
            <Route path="security-alerts" element={<SecurityAlertsPage />} />
            <Route path="integrations" element={<IntegrationsPage />} />
            <Route path="audit" element={<AuditLogPage />} />
          </Route>
          <Route element={<OrganizationContextProvider><Outlet /></OrganizationContextProvider>}>
            <Route index element={<SuiteHomePage />} />
            <Route element={<AuthenticatedLayout />}>
              <Route path="frris" element={<RedirectTo to={FRRIS_ROUTES.analyses} />} />
              <Route path="frris/analyses" element={<AnalysesListPage />} />
              <Route path="frris/analyses/new" element={<AnalysisSubmitPage />} />
              <Route path="frris/playground" element={<AreaPlaygroundPage />} />
              <Route path="frris/overview" element={<DashboardPage />} />
              <Route path="projects" element={<ProjectListPage />} />
              <Route path="projects/new" element={<ProjectFormPage />} />
              <Route path="projects/:projectId/edit" element={<ProjectFormPage />} />
              <Route path="projects/:projectId" element={<ProjectWorkspaceLayout />}>
                <Route index element={<ProjectDetailPage />} />
                <Route path="aois" element={<AoiListPage />} />
                <Route path="data" element={<ExternalDataPage />} />
                <Route path="analysis" element={<AnalysisSubmitPage embedded />} />
                <Route path="tasks" element={<TaskListPage />} />
                <Route path="results" element={<ResultListPage />} />
                <Route path="map" element={<ProjectUtilityPage mode="map" />} />
                <Route path="reports" element={<ProjectUtilityPage mode="reports" />} />
                <Route path="exports" element={<ProjectUtilityPage mode="exports" />} />
              </Route>
              <Route path="projects/:projectId/analyze" element={<AnalysisSubmitPage />} />
              {/* Moved in the UI refresh: the task center is now the FRRIS Analyses list. */}
              <Route path="tasks" element={<RedirectTo to={FRRIS_ROUTES.analyses} />} />
              <Route path="tasks/:taskId" element={<TaskDetailPage />} />
              <Route path="results" element={<ResultListPage />} />
              <Route path="results/:resultId" element={<ResultDetailPage />} />
              <Route path="aois" element={<PortfolioCapabilityPage mode="aois" />} />
              {/* Moved in the UI refresh: New analysis is a single FRRIS page with a project choice. */}
              <Route path="analyses" element={<RedirectTo to={FRRIS_ROUTES.newAnalysis} />} />
              <Route path="maps" element={<PortfolioCapabilityPage mode="map" />} />
              <Route path="reports" element={<PortfolioCapabilityPage mode="reports" />} />
              <Route path="exports" element={<PortfolioCapabilityPage mode="exports" />} />
              <Route path="data" element={<DataCatalogPage />} />
              <Route path="administration" element={<AdministrationPage />} />
              <Route path="external-data" element={<ExternalDataPage />} />
              <Route path="settings" element={<SettingsPage />} />
              <Route path="subscription" element={<SubscriptionPage />} />
            </Route>
          </Route>
        </Route>
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </Suspense>
  );
}
