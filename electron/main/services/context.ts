import type Database from "better-sqlite3";
import type { BuildVariantConfig } from "../../../src/shared/buildVariants.js";
import type { AppDirectories } from "../../../src/shared/types/domain.js";

export interface AppContext {
  version: string;
  directories: AppDirectories;
  db: Database.Database;
  buildVariant?: BuildVariantConfig;
}
