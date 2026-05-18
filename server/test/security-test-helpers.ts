import { SecretEncryptionService } from "../src/shared/security/secret-encryption.service";
import { createMockConfig } from "./test-helpers";

export function createMockSecretEncryption() {
  return new SecretEncryptionService(createMockConfig() as never);
}

export function createAllowingRateLimit() {
  return {
    assertAllowed: async () => undefined
  };
}

export function createActiveTokenStatus(active = true) {
  return {
    isActiveAccessToken: async () => active
  };
}
