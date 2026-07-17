import LegacyWorkspace from "../pages/legacy/LegacyWorkspace";
import { AppProviders } from "./providers";

export default function App(): JSX.Element {
  return (
    <AppProviders>
      <LegacyWorkspace />
    </AppProviders>
  );
}
