
import { User, QCReport } from './types';
import { INITIAL_ADMIN_USER } from './constants.tsx';

const USERS_KEY = 'flex_qc_users';
const REPORTS_KEY = 'flex_qc_reports';

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
};
