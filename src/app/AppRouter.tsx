import { lazy, Suspense } from "react";
import { Route, Routes } from "react-router-dom";
import { RequireSession } from "../features/auth/RequireSession";
import { LoginPage } from "../features/auth/LoginPage";
import { OrganizationContextProvider } from "../features/organization/OrganizationContext";
import { AuthenticatedLayout } from "./AuthenticatedLayout";
import { NotFoundPage } from "./NotFoundPage";

const ProjectListPage = lazy(() => import("../features/projects/ProjectListPage").then((module) => ({ default: module.ProjectListPage })));
const ProjectDetailPage = lazy(() => import("../features/projects/ProjectDetailPage").then((module) => ({ default: module.ProjectDetailPage })));
const ProjectFormPage = lazy(() => import("../features/projects/ProjectFormPage").then((module) => ({ default: module.ProjectFormPage })));
const AoiListPage = lazy(() => import("../features/aois/AoiListPage").then((module) => ({ default: module.AoiListPage })));
const AnalysisSubmitPage = lazy(() => import("../features/analyses/AnalysisSubmitPage").then((module) => ({ default: module.AnalysisSubmitPage })));
const TaskDetailPage = lazy(() => import("../features/tasks/TaskDetailPage").then((module) => ({ default: module.TaskDetailPage })));
const TaskListPage = lazy(() => import("../features/tasks/TaskListPage").then((module) => ({ default: module.TaskListPage })));
const ResultDetailPage = lazy(() => import("../features/results/ResultDetailPage").then((module) => ({ default: module.ResultDetailPage })));
const ResultListPage = lazy(() => import("../features/results/ResultListPage").then((module) => ({ default: module.ResultListPage })));
const DashboardPage = lazy(() => import("../features/dashboard/DashboardPage").then((module) => ({ default: module.DashboardPage })));
const ProjectWorkspaceLayout = lazy(() => import("../features/projects/ProjectWorkspaceLayout").then((module) => ({ default: module.ProjectWorkspaceLayout })));
const DataCatalogPage = lazy(() => import("../features/data/DataCatalogPage").then((module) => ({ default: module.DataCatalogPage })));
const ProjectUtilityPage = lazy(() => import("../features/projects/ProjectUtilityPage").then((module) => ({ default: module.ProjectUtilityPage })));
const SettingsPage = lazy(() => import("../features/settings/SettingsPage").then((module) => ({ default: module.SettingsPage })));
const PortfolioCapabilityPage = lazy(() => import("../features/projects/PortfolioCapabilityPage").then((module) => ({ default: module.PortfolioCapabilityPage })));

export function AppRouter() {
  return (
    <Suspense fallback={<main className="page-shell"><p>Loading NOVA workspace…</p></main>}>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route element={<RequireSession />}>
          <Route element={<OrganizationContextProvider><AuthenticatedLayout /></OrganizationContextProvider>}>
            <Route index element={<DashboardPage />} />
            <Route path="projects" element={<ProjectListPage />} />
            <Route path="projects/new" element={<ProjectFormPage />} />
            <Route path="projects/:projectId/edit" element={<ProjectFormPage />} />
            <Route path="projects/:projectId" element={<ProjectWorkspaceLayout />}>
              <Route index element={<ProjectDetailPage />} />
              <Route path="aois" element={<AoiListPage />} />
              <Route path="data" element={<DataCatalogPage />} />
              <Route path="analysis" element={<AnalysisSubmitPage />} />
              <Route path="tasks" element={<TaskListPage />} />
              <Route path="results" element={<ResultListPage />} />
              <Route path="map" element={<ProjectUtilityPage mode="map" />} />
              <Route path="reports" element={<ProjectUtilityPage mode="reports" />} />
              <Route path="exports" element={<ProjectUtilityPage mode="exports" />} />
            </Route>
            <Route path="projects/:projectId/analyze" element={<AnalysisSubmitPage />} />
            <Route path="tasks" element={<TaskListPage />} />
            <Route path="tasks/:taskId" element={<TaskDetailPage />} />
            <Route path="results" element={<ResultListPage />} />
            <Route path="results/:resultId" element={<ResultDetailPage />} />
            <Route path="aois" element={<PortfolioCapabilityPage mode="aois" />} />
            <Route path="analyses" element={<PortfolioCapabilityPage mode="analysis" />} />
            <Route path="maps" element={<PortfolioCapabilityPage mode="map" />} />
            <Route path="reports" element={<PortfolioCapabilityPage mode="reports" />} />
            <Route path="exports" element={<PortfolioCapabilityPage mode="exports" />} />
            <Route path="data" element={<DataCatalogPage />} />
            <Route path="settings" element={<SettingsPage />} />
          </Route>
        </Route>
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </Suspense>
  );
}
