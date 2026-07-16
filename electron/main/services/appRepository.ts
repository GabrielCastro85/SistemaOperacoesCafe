import type Database from "better-sqlite3";
import { randomUUID } from "node:crypto";
import { saveInstallationProfileSchema } from "../../../src/shared/schemas/domainSchemas.js";
import type { BootstrapData, InstallationProfile } from "../../../src/shared/types/domain.js";
import { mapInstallationProfile, mapLegalEntity, mapLocation, mapOrganization } from "../database/mappers.js";

type DbRecord = Record<string, unknown>;

export class AppRepository {
  constructor(private readonly db: Database.Database) {}

  getBootstrapData(version: string): BootstrapData {
    return {
      version,
      profile: this.getInstallationProfile(),
      organizations: (this.db.prepare("SELECT * FROM organizations WHERE is_active = 1 ORDER BY name").all() as DbRecord[]).map(
        mapOrganization
      ),
      legalEntities: (this.db.prepare("SELECT * FROM legal_entities WHERE is_active = 1 ORDER BY trade_name").all() as DbRecord[]).map(
        mapLegalEntity
      ),
      locations: (this.db.prepare("SELECT * FROM locations WHERE is_active = 1 ORDER BY name").all() as DbRecord[]).map(mapLocation)
    };
  }

  getInstallationProfile(): InstallationProfile | null {
    const row = this.db.prepare("SELECT * FROM installation_profiles ORDER BY created_at DESC LIMIT 1").get() as
      | Record<string, unknown>
      | undefined;
    return row ? mapInstallationProfile(row) : null;
  }

  saveInstallationProfile(input: unknown): InstallationProfile {
    const profile = saveInstallationProfileSchema.parse(input);
    const now = new Date().toISOString();
    const existing = this.getInstallationProfile();
    const id = existing?.id ?? randomUUID();
    if (existing) {
      this.db
        .prepare(
          `UPDATE installation_profiles
           SET installation_name = @installationName,
               app_variant = @appVariant,
               default_organization_id = @defaultOrganizationId,
               default_legal_entity_id = @defaultLegalEntityId,
               allow_organization_switch = @allowOrganizationSwitch,
               allow_legal_entity_switch = @allowLegalEntitySwitch,
               completed_setup = @completedSetup,
               updated_at = @updatedAt
           WHERE id = @id`
        )
        .run({
          id,
          installationName: profile.installationName,
          appVariant: profile.appVariant,
          defaultOrganizationId: profile.defaultOrganizationId,
          defaultLegalEntityId: profile.defaultLegalEntityId,
          allowOrganizationSwitch: profile.allowOrganizationSwitch ? 1 : 0,
          allowLegalEntitySwitch: profile.allowLegalEntitySwitch ? 1 : 0,
          completedSetup: profile.completedSetup ? 1 : 0,
          updatedAt: now
        });
    } else {
      this.db
        .prepare(
          `INSERT INTO installation_profiles (
            id, installation_name, app_variant, default_organization_id, default_legal_entity_id,
            allow_organization_switch, allow_legal_entity_switch, completed_setup, created_at, updated_at
          ) VALUES (@id, @installationName, @appVariant, @defaultOrganizationId, @defaultLegalEntityId,
            @allowOrganizationSwitch, @allowLegalEntitySwitch, @completedSetup, @createdAt, @updatedAt)`
        )
        .run({
          id,
          installationName: profile.installationName,
          appVariant: profile.appVariant,
          defaultOrganizationId: profile.defaultOrganizationId,
          defaultLegalEntityId: profile.defaultLegalEntityId,
          allowOrganizationSwitch: profile.allowOrganizationSwitch ? 1 : 0,
          allowLegalEntitySwitch: profile.allowLegalEntitySwitch ? 1 : 0,
          completedSetup: profile.completedSetup ? 1 : 0,
          createdAt: now,
          updatedAt: now
        });
    }
    const saved = this.getInstallationProfile();
    if (!saved) {
      throw new Error("Falha ao salvar o perfil de instalacao.");
    }
    return saved;
  }

  setActiveLegalEntity(legalEntityId: string): InstallationProfile {
    const existing = this.getInstallationProfile();
    if (!existing) {
      throw new Error("Perfil de instalacao nao configurado.");
    }
    return this.saveInstallationProfile({
      ...existing,
      defaultLegalEntityId: legalEntityId
    });
  }
}
