
export type Stage = 'FQC' | 'Packaging' | null;

export interface User {
  userId: string;
  password: string;
  isAdmin: boolean;
  isActive: boolean;
  assignedStage: Stage;
}

export interface CheckpointResult {
  id: string;
  label: string;
  status: 'Pass' | 'Fail' | null;
  image: string | null; // base64 or path
  reason: string;
}

export interface QCReport {
  id: string;
  timestamp: string;
  stage: Stage;
  userId: string;
  deviceId: string;
  checkpoints: CheckpointResult[];
}

export enum AppStep {
  STAGE_SELECTION,
  LOGIN,
  DEVICE_ID_ENTRY,
  CHECKLIST,
  SUCCESS,
  ADMIN
}
