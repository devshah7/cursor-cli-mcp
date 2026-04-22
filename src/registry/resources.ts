import { cliPermissionsReference } from '../resources/cliPermissions.js';
import { rulesDiscovery } from '../resources/rulesDiscovery.js';

export interface ResourceDescriptor {
  name: string;
  uri: string;
  description?: string;
  mimeType: string;
  content: string;
}

export const ALL_RESOURCES: ResourceDescriptor[] = [cliPermissionsReference, rulesDiscovery];
