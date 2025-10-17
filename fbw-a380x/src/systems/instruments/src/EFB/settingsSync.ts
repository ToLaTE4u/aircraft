// Copyright (c) 2024 FlyByWire Simulations
// SPDX-License-Identifier: GPL-3.0

import { SyncedSettingDefinition } from '@flybywiresim/flypad';
import { A380X_DEFAULT_RADIO_AUTO_CALL_OUTS } from 'shared/src/AutoCallOuts';

export const a380xSyncedSettings: SyncedSettingDefinition[] = [
  {
    configKey: 'CONFIG_A380X_FWC_RADIO_AUTO_CALL_OUT_PINS',
    localVarName: 'L:A380X_FWC_RADIO_AUTO_CALL_OUT_PINS',
    defaultValue: A380X_DEFAULT_RADIO_AUTO_CALL_OUTS.toString(),
  },
  // Display FPS Throttling Settings
  {
    configKey: 'CONFIG_A380X_ND_DISPLAY_FPS',
    localVarName: 'L:A380X_ND_FPS_THROTTLE',
    defaultValue: '15',
  },
  {
    configKey: 'CONFIG_A380X_PFD_DISPLAY_FPS',
    localVarName: 'L:A380X_PFD_FPS_THROTTLE',
    defaultValue: '30',
  },
  {
    configKey: 'CONFIG_A380X_OANC_DISPLAY_FPS',
    localVarName: 'L:A380X_OANC_FPS_THROTTLE',
    defaultValue: '15',
  },
];
