import { useCallback, useEffect, useState } from "react";
import type { BootstrapData, InstallationProfile } from "../../shared/types/domain";
import { AppLayout } from "../layouts/AppLayout";
import { ConfirmationsPage } from "../pages/confirmations/ConfirmationsPage";
import { ConfirmationReportsPage } from "../pages/confirmations/ConfirmationReportsPage";
import { ClauseLibraryPage } from "../pages/confirmations/ClauseLibraryPage";
import { ConfirmationTemplatesPage } from "../pages/confirmations/ConfirmationTemplatesPage";
import { SpreadsheetImportHistoryPage } from "../pages/imports/spreadsheet/SpreadsheetImportHistoryPage";
import { SpreadsheetImportPage } from "../pages/imports/spreadsheet/SpreadsheetImportPage";
import { SpreadsheetMappingTemplatesPage } from "../pages/imports/spreadsheet/SpreadsheetMappingTemplatesPage";
import { ClassificationRulesPage } from "../pages/imports/xml/ClassificationRulesPage";
import { ProductAliasesPage } from "../pages/imports/xml/ProductAliasesPage";
import { XmlImportHistoryPage } from "../pages/imports/xml/XmlImportHistoryPage";
import { XmlImportPage } from "../pages/imports/xml/XmlImportPage";
import { ChargesPage } from "../pages/charges/ChargesPage";
import { ClientLedgerPage } from "../pages/clientLedger/ClientLedgerPage";
import {
  Dashboard,
  FinancialPage,
  ModulePlaceholder,
  SettingsPage,
  SetupWizard,
  Splash
} from "../pages/legacy/LegacyWorkspace";
import { OperationsPage } from "../pages/operations/OperationsPage";
import { PartnersPage } from "../pages/partners/PartnersPage";
import { ProductsPage } from "../pages/products/ProductsPage";
import { ServiceRateRulesPage } from "../pages/serviceRates/ServiceRateRulesPage";
import { legacyMenuFromPath, pathFromLegacyMenu } from "./navigation";
import { AppProviders } from "./providers";

export default function App(): JSX.Element {
  return (
    <AppProviders>
      <RoutedApp />
    </AppProviders>
  );
}

function RoutedApp(): JSX.Element {
  const [data, setData] = useState<BootstrapData | null>(null);
  const [profile, setProfile] = useState<InstallationProfile | null>(null);
  const [path, setPath] = useState(() => currentPath());

  const refresh = useCallback(async (): Promise<BootstrapData> => {
    const bootstrap = await window.operationsCafe.getBootstrapData();
    setData(bootstrap);
    setProfile(bootstrap.profile);
    return bootstrap;
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    const handlePopState = (): void => setPath(currentPath());
    window.addEventListener("popstate", handlePopState);
    window.addEventListener("hashchange", handlePopState);
    return () => {
      window.removeEventListener("popstate", handlePopState);
      window.removeEventListener("hashchange", handlePopState);
    };
  }, []);

  if (!data) return <Splash />;
  if (!profile?.completedSetup) return <SetupWizard data={data} onSaved={setProfile} />;

  const organization = data.organizations.find((item) => item.id === profile.defaultOrganizationId) ?? data.organizations[0] ?? null;
  const legalEntity = data.legalEntities.find((item) => item.id === profile.defaultLegalEntityId) ?? null;
  const orgEntities = data.legalEntities.filter((item) => item.organizationId === organization?.id && item.isActive);
  const activeMenu = legacyMenuFromPath(path);
  const canSwitchOrg = Boolean(profile.allowOrganizationSwitch && profile.appVariant === "multiempresa");

  async function changeLegalEntity(id: string): Promise<void> {
    if (!id) return;
    setProfile(await window.operationsCafe.setActiveLegalEntity(id));
    await refresh();
  }

  async function changeOrganization(id: string): Promise<void> {
    if (!id) return;
    setProfile(await window.operationsCafe.setActiveOrganization(id));
    await refresh();
  }

  function navigate(menu: string): void {
    const nextPath = pathFromLegacyMenu(menu);
    window.history.pushState(null, "", `#${nextPath}`);
    setPath(nextPath);
  }

  const page = renderRoute(path, data, profile, refresh, setProfile);

  return (
    <AppLayout
      variant={profile.appVariant}
      organization={organization}
      organizations={data.organizations}
      legalEntity={legalEntity}
      legalEntities={orgEntities}
      activeMenu={activeMenu}
      canSwitchOrganization={canSwitchOrg}
      canSwitchLegalEntity={Boolean(profile.allowLegalEntitySwitch)}
      version={data.version}
      onNavigate={navigate}
      onOrganizationChange={(id) => void changeOrganization(id)}
      onLegalEntityChange={(id) => void changeLegalEntity(id)}
    >
      {page}
    </AppLayout>
  );
}

function renderRoute(
  path: string,
  data: BootstrapData,
  profile: InstallationProfile,
  refresh: () => Promise<BootstrapData>,
  setProfile: (profile: InstallationProfile) => void
): JSX.Element {
  if (path.startsWith("/operations")) return <OperationsPage data={data} />;
  if (path.startsWith("/imports/spreadsheets/history")) return <SpreadsheetImportHistoryPage />;
  if (path.startsWith("/imports/spreadsheets/templates")) return <SpreadsheetMappingTemplatesPage />;
  if (path.startsWith("/imports/spreadsheets")) return <SpreadsheetImportPage data={data} />;
  if (path.startsWith("/imports/xml/classification-rules")) return <ClassificationRulesPage />;
  if (path.startsWith("/imports/xml/product-aliases")) return <ProductAliasesPage />;
  if (path.startsWith("/imports/xml/history")) return <XmlImportHistoryPage />;
  if (path.startsWith("/imports/xml")) return <XmlImportPage data={data} />;
  if (path.startsWith("/confirmations/templates")) return <ConfirmationTemplatesPage templates={[]} />;
  if (path.startsWith("/confirmations/clauses")) return <ClauseLibraryPage clauses={[]} />;
  if (path.startsWith("/confirmations/reports")) return <ConfirmationReportsPage />;
  if (path.startsWith("/confirmations")) return <ConfirmationsPage data={data} />;
  if (path.startsWith("/partners")) return <PartnersPage data={data} refresh={refresh} />;
  if (path.startsWith("/products")) return <ProductsPage data={data} refresh={refresh} />;
  if (path.startsWith("/billing/rates") || path.startsWith("/rates")) return <ServiceRateRulesPage data={data} />;
  if (path.startsWith("/charges")) return <ChargesPage data={data} />;
  if (path.startsWith("/client-ledger")) return <ClientLedgerPage data={data} />;
  if (path.startsWith("/finance")) return <FinancialPage data={data} />;
  if (path.startsWith("/settings")) return <SettingsPage profile={profile} refresh={refresh} onProfile={setProfile} />;
  if (path.startsWith("/reports")) return <ModulePlaceholder title="Relatórios" />;
  return <Dashboard organizations={data.organizations} legalEntities={data.legalEntities} locations={data.locations} organizationId={data.profile?.defaultOrganizationId ?? undefined} />;
}

function currentPath(): string {
  return window.location.hash.replace(/^#/, "") || "/dashboard";
}
