
import { User, QCReport } from './types';
import { INITIAL_ADMIN_USER } from './constants.tsx';

const USERS_KEY = 'flex_qc_users';
const REPORTS_KEY = 'flex_qc_reports';
const DEVICE_STATUS_KEY = 'flex_qc_device_status';

export const getStoredUsers = (): User[] => {
  const stored = localStorage.getItem(USERS_KEY);
  if (!stored) {
    const defaultUsers = [INITIAL_ADMIN_USER];
    localStorage.setItem(USERS_KEY, JSON.stringify(defaultUsers));
    return defaultUsers;
  }
  return JSON.parse(stored);
};

export const saveUsers = (users: User[]) => {
  localStorage.setItem(USERS_KEY, JSON.stringify(users));
};

export const getStoredReports = (): QCReport[] => {
  const stored = localStorage.getItem(REPORTS_KEY);
  return stored ? JSON.parse(stored) : [];
};

export const saveReport = (report: QCReport) => {
  const reports = getStoredReports();
  reports.push(report);
  localStorage.setItem(REPORTS_KEY, JSON.stringify(reports));
  
  // Log to console for debugging "Google Sheets" simulation
  console.log('✅ Report Saved to "Database":', report);
  
  // Update device status after report submission
  updateDeviceStatus(report.deviceId, report.stage, 'completed');
};

export interface DeviceStatus {
  deviceId: string;
  fqcStatus: 'pending' | 'completed' | 'failed';
  packagingStatus: 'pending' | 'completed' | 'failed';
  lastUpdated: string;
}

export const getDeviceStatus = (deviceId: string): DeviceStatus | null => {
  const allStatuses = getDeviceStatuses();
  return allStatuses.find(status => status.deviceId === deviceId) || null;
};

export const getDeviceStatuses = (): DeviceStatus[] => {
  const stored = localStorage.getItem(DEVICE_STATUS_KEY);
  return stored ? JSON.parse(stored) : [];
};

export const updateDeviceStatus = (deviceId: string, stage: 'FQC' | 'Packaging', status: 'pending' | 'completed' | 'failed') => {
  const allStatuses = getDeviceStatuses();
  const existingIndex = allStatuses.findIndex(s => s.deviceId === deviceId);
  
  const newStatus: DeviceStatus = {
    deviceId,
    fqcStatus: 'pending',
    packagingStatus: 'pending',
    lastUpdated: new Date().toISOString()
  };
  
  if (existingIndex >= 0) {
    // Update existing status
    const existingStatus = allStatuses[existingIndex];
    if (stage === 'FQC') {
      existingStatus.fqcStatus = status;
    } else if (stage === 'Packaging') {
      existingStatus.packagingStatus = status;
    }
    existingStatus.lastUpdated = new Date().toISOString();
  } else {
    // Create new status
    if (stage === 'FQC') {
      newStatus.fqcStatus = status;
    } else if (stage === 'Packaging') {
      newStatus.packagingStatus = status;
    }
    allStatuses.push(newStatus);
  }
  
  localStorage.setItem(DEVICE_STATUS_KEY, JSON.stringify(allStatuses));
};
