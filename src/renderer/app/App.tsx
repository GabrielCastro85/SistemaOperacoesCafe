import { useCallback, useEffect, useState } from "react";
import type { AuthSession, BootstrapData, InstallationProfile } from "../../shared/types/domain";
import { AppLayout } from "../layouts/AppLayout";
import "../styles/index.css";
import { AuditPage } from "../pages/audit/AuditPage";
import { FirstAdminSetupPage, LockScreen, LoginPage } from "../pages/auth/AuthPages";
import { OrganizationPickerPage, setRememberedOrganizationId } from "../pages/auth/OrganizationPickerPage";
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
import { Dashboard, NotFoundPage, SetupWizard, Splash } from "../pages/appStates/AppStatePages";
import { CostCentersPage } from "../pages/finance/CostCentersPage";
import { ExpenseCategoriesPage } from "../pages/finance/ExpenseCategoriesPage";
import { FinanceOverviewPage } from "../pages/finance/FinanceOverviewPage";
import { FinancialAccountsPage } from "../pages/finance/FinancialAccountsPage";
import { FinancialCalendarPage } from "../pages/finance/FinancialCalendarPage";
import { FinancialReportHistoryPage } from "../pages/finance/FinancialReportHistoryPage";
import { FinancialReportsPage } from "../pages/finance/FinancialReportsPage";
import { InstallmentGroupDetailsPage } from "../pages/finance/InstallmentGroupDetailsPage";
import { InstallmentGroupsPage } from "../pages/finance/InstallmentGroupsPage";
import { PayableCreatePage } from "../pages/finance/PayableCreatePage";
import { PayableDetailsPage } from "../pages/finance/PayableDetailsPage";
import { PayablePaymentDetailsPage } from "../pages/finance/PayablePaymentDetailsPage";
import { PayablePaymentsPage } from "../pages/finance/PayablePaymentsPage";
import { PayablesPage } from "../pages/finance/PayablesPage";
import { RecurringPayableDetailsPage } from "../pages/finance/RecurringPayableDetailsPage";
import { RecurringPayablesPage } from "../pages/finance/RecurringPayablesPage";
import { OperationsPage } from "../pages/operations/OperationsPage";
import { PartnersPage } from "../pages/partners/PartnersPage";
import { ProductsPage } from "../pages/products/ProductsPage";
import { PurchaseRateRulesPage } from "../pages/purchaseRates/PurchaseRateRulesPage";
import { PurchaseSettlementsPage } from "../pages/purchaseSettlements/PurchaseSettlementsPage";
import { ServiceRateRulesPage } from "../pages/serviceRates/ServiceRateRulesPage";
import { BrandingSettingsPage } from "../pages/settings/branding/BrandingSettingsPage";
import { BackupCreatePage, BackupDetailsPage, BackupsPage, BackupSettingsPage, IntegrityPage, RestorePage, RetentionPage } from "../pages/settings/backups/BackupPages";
import { AboutPage } from "../pages/settings/about/AboutPage";
import { DiagnosticsPage } from "../pages/settings/diagnostics/DiagnosticsPage";
import { DirectoriesPage } from "../pages/settings/directories/DirectoriesPage";
import { InstallationProfilePage } from "../pages/settings/installation/InstallationProfilePage";
import { LegalEntitiesPage } from "../pages/settings/legalEntities/LegalEntitiesPage";
import { LegalEntityCreatePage } from "../pages/settings/legalEntities/LegalEntityCreatePage";
import { LegalEntityDetailsPage } from "../pages/settings/legalEntities/LegalEntityDetailsPage";
import { LocationCreatePage } from "../pages/settings/locations/LocationCreatePage";
import { LocationDetailsPage } from "../pages/settings/locations/LocationDetailsPage";
import { LocationsPage } from "../pages/settings/locations/LocationsPage";
import { OrganizationCreatePage } from "../pages/settings/organizations/OrganizationCreatePage";
import { OrganizationDetailsPage } from "../pages/settings/organizations/OrganizationDetailsPage";
import { OrganizationsPage } from "../pages/settings/organizations/OrganizationsPage";
import { DocumentSequencesPage } from "../pages/settings/sequences/DocumentSequencesPage";
import { SettingsHomePage } from "../pages/settings/SettingsHomePage";
import { SystemSettingsPage } from "../pages/settings/SystemSettingsPage";
import { RolesPage } from "../pages/settings/roles/RolesPage";
import { UsersPage } from "../pages/settings/users/UsersPage";
import { ChangePasswordPage } from "../pages/settings/ChangePasswordPage";
import { legacyMenuFromPath, pathFromLegacyMenu } from "./navigation";
import { AppProviders } from "./providers";

function isOperationalLegalEntity(entity: { documentPrefix: string | null }): boolean {
  return entity.documentPrefix !== "TERC-XML";
}

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
  const [needsBootstrap, setNeedsBootstrap] = useState<boolean | null>(null);
  const [session, setSession] = useState<AuthSession | null>(null);
  const [path, setPath] = useState(() => currentPath());
  const [orgPickerDismissed, setOrgPickerDismissed] = useState(false);

  const refresh = useCallback(async (): Promise<BootstrapData> => {
    const bootstrap = await window.operationsCafe.getBootstrapData();
    setData(bootstrap);
    setProfile(bootstrap.profile);
    return bootstrap;
  }, []);

  useEffect(() => {
    void Promise.all([window.operationsCafe.authNeedsBootstrap(), window.operationsCafe.authCurrentSession()]).then(([bootstrapRequired, currentSession]) => {
      setNeedsBootstrap(bootstrapRequired);
      setSession(currentSession);
      if (!bootstrapRequired && currentSession?.status === "ACTIVE") void refresh();
    });
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

  if (needsBootstrap === null) return <Splash />;
  if (needsBootstrap) return <FirstAdminSetupPage onSession={(nextSession) => { setNeedsBootstrap(false); setSession(nextSession); void refresh(); }} />;
  if (!session) return <LoginPage onSession={(nextSession) => { setSession(nextSession); void refresh(); }} />;
  if (session.user.mustChangePassword) return <ChangePasswordPage session={session} onSession={setSession} mandatory />;
  if (!data) return <Splash />;
  if (!profile?.completedSetup) return <SetupWizard data={data} onSaved={setProfile} />;

  const activeOrganizations = data.organizations.filter((item) => item.isActive);
  const canPickOrganization = profile.appVariant === "multiempresa" && activeOrganizations.length > 1;
  if (canPickOrganization && !orgPickerDismissed) {
    return (
      <OrganizationPickerPage
        organizations={data.organizations}
        legalEntities={data.legalEntities}
        defaultOrganizationId={profile.defaultOrganizationId}
        defaultLegalEntityId={profile.defaultLegalEntityId}
        onSelect={(organizationId, legalEntityId) => {
          void window.operationsCafe.setActiveOrganization(organizationId).then(async () => {
            const nextProfile = await window.operationsCafe.setActiveLegalEntity(legalEntityId);
            setProfile(nextProfile);
            setRememberedOrganizationId(null);
            setOrgPickerDismissed(true);
            await refresh();
          });
        }}
      />
    );
  }

  const organization = data.organizations.find((item) => item.id === profile.defaultOrganizationId) ?? data.organizations[0] ?? null;
  const legalEntity = data.legalEntities.find((item) => item.id === profile.defaultLegalEntityId) ?? null;
  const orgEntities = data.legalEntities.filter((item) => item.organizationId === organization?.id && item.isActive && isOperationalLegalEntity(item));
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

  const page = renderRoute(path, data, profile, refresh, setProfile, session, setSession);

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
      session={session}
      onNavigate={navigate}
      onOrganizationChange={(id) => void changeOrganization(id)}
      onLegalEntityChange={(id) => void changeLegalEntity(id)}
      onLock={() => void window.operationsCafe.authLock().then((nextSession) => setSession(nextSession))}
      onLogout={() => void window.operationsCafe.authLogout().then(() => { setSession(null); setOrgPickerDismissed(false); })}
    >
      {page}
      {session.status === "LOCKED" ? <LockScreen session={session} onSession={setSession} /> : null}
    </AppLayout>
  );
}

function renderRoute(
  path: string,
  data: BootstrapData,
  profile: InstallationProfile,
  refresh: () => Promise<BootstrapData>,
  setProfile: (profile: InstallationProfile) => void,
  session: AuthSession,
  setSession: (session: AuthSession) => void
): JSX.Element {
  if (path.startsWith("/settings/change-password")) return <ChangePasswordPage session={session} onSession={setSession} />;
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
  if (path.startsWith("/finance/purchase-settlements")) return <PurchaseSettlementsPage data={data} />;
  if (path.startsWith("/finance/purchase-rates")) return <PurchaseRateRulesPage data={data} />;
  if (path.startsWith("/finance/payables/new")) return <PayableCreatePage data={data} />;
  if (path.startsWith("/finance/payables/")) return <PayableDetailsPage data={data} id={routeTail(path, "/finance/payables/")} />;
  if (path.startsWith("/finance/payables")) return <PayablesPage data={data} />;
  if (path.startsWith("/finance/recurring/new")) return <RecurringPayablesPage data={data} />;
  if (path.startsWith("/finance/recurring/")) return <RecurringPayableDetailsPage data={data} id={routeTail(path, "/finance/recurring/")} />;
  if (path.startsWith("/finance/recurring")) return <RecurringPayablesPage data={data} />;
  if (path.startsWith("/finance/installments/")) return <InstallmentGroupDetailsPage data={data} id={routeTail(path, "/finance/installments/")} />;
  if (path.startsWith("/finance/installments")) return <InstallmentGroupsPage data={data} />;
  if (path.startsWith("/finance/payments/")) return <PayablePaymentDetailsPage data={data} id={routeTail(path, "/finance/payments/")} />;
  if (path.startsWith("/finance/payments")) return <PayablePaymentsPage data={data} />;
  if (path.startsWith("/finance/calendar")) return <FinancialCalendarPage data={data} />;
  if (path.startsWith("/finance/categories")) return <ExpenseCategoriesPage data={data} />;
  if (path.startsWith("/finance/cost-centers")) return <CostCentersPage data={data} />;
  if (path.startsWith("/finance/accounts")) return <FinancialAccountsPage data={data} />;
  if (path.startsWith("/finance/reports/history")) return <FinancialReportHistoryPage data={data} />;
  if (path.startsWith("/finance/reports/")) return <FinancialReportHistoryPage data={data} id={routeTail(path, "/finance/reports/")} />;
  if (path.startsWith("/finance/reports") || path.startsWith("/reports")) return <FinancialReportsPage data={data} />;
  if (path.startsWith("/finance")) return <FinanceOverviewPage data={data} />;
  const settingsProps = { data, profile, refresh, onProfile: setProfile };
  if (path.startsWith("/settings/organizations/new")) return <OrganizationCreatePage {...settingsProps} />;
  if (path.startsWith("/settings/organizations/")) return <OrganizationDetailsPage {...settingsProps} />;
  if (path.startsWith("/settings/organizations")) return <OrganizationsPage {...settingsProps} />;
  if (path.startsWith("/settings/legal-entities/new")) return <LegalEntityCreatePage {...settingsProps} />;
  if (path.startsWith("/settings/legal-entities/")) return <LegalEntityDetailsPage {...settingsProps} />;
  if (path.startsWith("/settings/legal-entities")) return <LegalEntitiesPage {...settingsProps} />;
  if (path.startsWith("/settings/locations/new")) return <LocationCreatePage {...settingsProps} />;
  if (path.startsWith("/settings/locations/")) return <LocationDetailsPage {...settingsProps} />;
  if (path.startsWith("/settings/locations")) return <LocationsPage {...settingsProps} />;
  if (path.startsWith("/settings/branding")) return <BrandingSettingsPage {...settingsProps} />;
  if (path.startsWith("/settings/installation")) return <InstallationProfilePage {...settingsProps} />;
  if (path.startsWith("/settings/about")) return <AboutPage />;
  if (path.startsWith("/settings/diagnostics")) return <DiagnosticsPage />;
  if (path.startsWith("/settings/directories")) return <DirectoriesPage />;
  if (path.startsWith("/settings/users")) return <UsersPage />;
  if (path.startsWith("/settings/roles")) return <RolesPage />;
  if (path.startsWith("/settings/backups/new")) return <BackupCreatePage />;
  if (path.startsWith("/settings/backups/settings")) return <BackupSettingsPage />;
  if (path.startsWith("/settings/backups/")) return <BackupDetailsPage id={routeTail(path, "/settings/backups/")} />;
  if (path.startsWith("/settings/backups")) return <BackupsPage />;
  if (path.startsWith("/settings/restore")) return <RestorePage />;
  if (path.startsWith("/settings/integrity")) return <IntegrityPage />;
  if (path.startsWith("/settings/retention")) return <RetentionPage />;
  if (path.startsWith("/settings/document-sequences")) return <DocumentSequencesPage />;
  if (path.startsWith("/settings/import-templates")) return <SpreadsheetMappingTemplatesPage />;
  if (path.startsWith("/settings/confirmation-templates")) return <ConfirmationTemplatesPage templates={[]} />;
  if (path.startsWith("/settings/clauses")) return <ClauseLibraryPage clauses={[]} />;
  if (path.startsWith("/settings/system")) return <SystemSettingsPage />;
  if (path.startsWith("/audit")) return <AuditPage />;
  if (path.startsWith("/settings")) return <SettingsHomePage />;
  if (path === "/dashboard" || path === "/") return <Dashboard organizations={data.organizations} legalEntities={data.legalEntities} locations={data.locations} organizationId={data.profile?.defaultOrganizationId ?? undefined} ownLegalEntityId={data.profile?.defaultLegalEntityId ?? null} />;
  return <NotFoundPage />;
}

function currentPath(): string {
  return window.location.hash.replace(/^#/, "") || "/dashboard";
}

function routeTail(path: string, prefix: string): string | null {
  return path.slice(prefix.length).split("/")[0] || null;
}
