export interface ResourceDescriptor {
  name: string;
  uri: string;
  description?: string;
  mimeType: string;
  content: string;
}

export const ALL_RESOURCES: ResourceDescriptor[] = [];
