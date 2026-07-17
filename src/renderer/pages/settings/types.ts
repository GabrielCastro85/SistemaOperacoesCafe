import type { BootstrapData, InstallationProfile } from "../../../shared/types/domain";

export type StatusFilter = "active" | "inactive" | "all";

export interface SettingsPageProps {
  data: BootstrapData;
  profile: InstallationProfile;
  refresh: () => Promise<BootstrapData>;
  onProfile: (profile: InstallationProfile) => void;
}
