/** Tag entity, managed by the tag plugin ("tags" collection). */
export interface Tag {
  readonly id: string;
  readonly schemaVersion: number;
  readonly name: string;
  readonly color?: string;
  readonly createdAt: string;
}

export const TAG_SCHEMA_VERSION = 1;
