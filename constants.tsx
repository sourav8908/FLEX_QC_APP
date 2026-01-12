
import React from 'react';
import { CheckpointResult, User } from './types';

export const FQC_CHECKPOINTS: Omit<CheckpointResult, 'status' | 'image' | 'reason'>[] = [
  { id: 'scr_01', label: 'Screen Surface Scratch Test' },
  { id: 'bat_02', label: 'Battery Contact Alignment' },
  { id: 'btn_03', label: 'Tactile Button Feedback' },
  { id: 'chg_04', label: 'Charging Port Inspection' },
];

export const PACKAGING_CHECKPOINTS: Omit<CheckpointResult, 'status' | 'image' | 'reason'>[] = [
  { id: 'lbl_01', label: 'Serial Label Matching' },
  { id: 'box_02', label: 'Box Integrity & Corner Strength' },
  { id: 'acc_03', label: 'Accessories (Cable/Manual) Inclusion' },
  { id: 'sel_04', label: 'Anti-Tamper Seal Application' },
];

export const INITIAL_ADMIN_USER: User = {
  userId: 'admin',
  password: '123',
  isAdmin: true,
  isActive: true,
  assignedStage: 'FQC'
};
