
import React from 'react';
import { CheckpointResult, User } from './types';

export const FQC_CHECKPOINTS: Omit<CheckpointResult, 'status' | 'image' | 'reason'>[] = [
  { id: 'fqc_01', label: 'Check for outer body – no scratches, cracks, dents (Top & Bottom Panel)' },
  { id: 'fqc_02', label: 'Check for all 7 screws properly mounted' },
  { id: 'fqc_03', label: 'Check for keypad – all buttons present as per layout, symbols clear and legible' },
  { id: 'fqc_04', label: 'Check display segment placement with Tohands logo and protective film attached; no dent, scratches, or gap between display and top cover' },
  { id: 'fqc_05', label: 'Check for laser marking: Smart Calculator V5 Powered by AI' },
  { id: 'fqc_06', label: 'Check both C-Type USB pin connectors – Charging (Right side) & Printer (Left side)' },
  { id: 'fqc_07', label: 'Verify LED light working during Power ON and charger connectivity' },
  { id: 'fqc_08', label: 'Display turns ON properly – no missing segments / black spots, proper brightness and contrast' },
  { id: 'fqc_09', label: 'Check Device ID verification with respect to System Info and Device Label' },
  { id: 'fqc_10', label: 'Observe speaker sound and voice quality' },
  { id: 'fqc_11', label: 'Check battery cover properly fixed and sticker position as per standard' },
  { id: 'fqc_12', label: 'Check label content clearly printed' },
];

export const PACKAGING_CHECKPOINTS: Omit<CheckpointResult, 'status' | 'image' | 'reason'>[] = [
  { id: 'pkg_01', label: 'Verify that the Device ID matches exactly across all three references: Internal Device ID (Calculator), Device ID on the bottom panel of the device, Device ID on the outer box label' },
  { id: 'pkg_02', label: 'Ensure the protective case is properly attached to the device' },
  { id: 'pkg_03', label: 'Verify the device is correctly placed inside the white device sleeve with logo, and ensure proper logo alignment' },
  { id: 'pkg_04', label: 'Confirm Packing Box Insert – 1 is present inside the packaging box' },
  { id: 'pkg_05', label: 'Verify the charging adapter and power cable (Type-C to Type-C) are correctly packed in Packing Box Insert – 2' },
  { id: 'pkg_06', label: 'Ensure the user manual / quick start guide is available inside the box' },
  { id: 'pkg_07', label: 'Verify the packaging box is properly closed and sealed using two circular package seal stickers' },
  { id: 'pkg_08', label: 'Ensure the closed box is covered with the packing sleeve (green & white) as per standard' },
  { id: 'pkg_09', label: 'Confirm the box is fully closed and secured by applying the wrapping cover' },
  { id: 'pkg_10', label: 'Verify the packed box weight falls within the approved acceptable range' },
];

export const INITIAL_ADMIN_USER: User = {
  userId: 'admin',
  password: '123',
  isAdmin: true,
  isActive: true,
  assignedStage: 'FQC'
};
