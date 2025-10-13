// Copyright (c) 2023-2024 FlyByWire Simulations
// SPDX-License-Identifier: GPL-3.0

import { FeatureType, PolygonalStructureType } from '@flybywiresim/fbw-sdk';

export interface StyleRule {
  forFeatureTypes?: FeatureType[];

  forPolygonStructureTypes?: PolygonalStructureType[];

  dontFetchFromAmdb?: boolean;

  styles: {
    doStroke: boolean;

    doFill: boolean;

    strokeStyle?: string;

    lineWidth?: number;

    fillStyle?: string;
  };
}

// OPTIMIZATION: Consolidated from 8 layers to 4 layers to reduce VRAM usage by 50%
// Layer 0: Base layer (Taxiways, Aprons, Runways, Buildings)
// Layer 1: Guidance lines (All guidance/marking lines with background)
// Layer 2: Runway highlights (white fill for runways)
// Layer 3: Dynamic overlay (BTV paths, user markers)
export const STYLE_DATA: Record<number, StyleRule[]> = {
  0: [
    // Taxiway elements
    {
      forFeatureTypes: [FeatureType.TaxiwayElement],
      styles: { doStroke: false, doFill: true, fillStyle: '#8f8f8f' },
    },
    {
      forFeatureTypes: [FeatureType.TaxiwayShoulder],
      styles: { doStroke: false, doFill: true, fillStyle: '#85451d' },
    },
    {
      forFeatureTypes: [FeatureType.ServiceRoad],
      styles: { doStroke: false, doFill: true, fillStyle: '#b59824' },
    },
    // Apron elements
    {
      forFeatureTypes: [FeatureType.ApronElement],
      styles: { doStroke: false, doFill: true, fillStyle: '#545454' },
    },
    {
      forFeatureTypes: [FeatureType.ParkingStandArea],
      styles: { doStroke: false, doFill: true, fillStyle: '#778585' },
    },
    // Buildings
    {
      forFeatureTypes: [FeatureType.VerticalPolygonalStructure],
      forPolygonStructureTypes: [PolygonalStructureType.TerminalBuilding],
      styles: { doStroke: false, doFill: true, fillStyle: '#00ffff' },
    },
    {
      forFeatureTypes: [FeatureType.VerticalPolygonalStructure],
      forPolygonStructureTypes: [PolygonalStructureType.NonTerminalBuilding],
      styles: { doStroke: false, doFill: true, fillStyle: '#3286da' },
    },
    // Runways with markings
    {
      forFeatureTypes: [
        FeatureType.RunwayElement,
        FeatureType.RunwayIntersection,
        FeatureType.BlastPad,
        FeatureType.RunwayDisplacedArea,
        FeatureType.Stopway,
      ],
      styles: { doStroke: false, doFill: true, fillStyle: 'gray' },
    },
    {
      forFeatureTypes: [FeatureType.RunwayMarking],
      styles: { doStroke: false, doFill: true, fillStyle: '#ffffff' },
    },
    {
      forFeatureTypes: [FeatureType.RunwayShoulder],
      styles: { doStroke: false, doFill: true, fillStyle: '#85451d' },
    },
  ],
  1: [
    // Guidance line backgrounds (drawn first, wider)
    {
      forFeatureTypes: [FeatureType.TaxiwayGuidanceLine, FeatureType.RunwayExitLine],
      styles: { doStroke: true, doFill: false, strokeStyle: '#666666', lineWidth: 8 },
    },
    // Guidance lines (drawn on top, thinner, yellow)
    {
      forFeatureTypes: [FeatureType.TaxiwayGuidanceLine, FeatureType.RunwayExitLine],
      styles: { doStroke: true, doFill: false, strokeStyle: '#ffff00', lineWidth: 1.85 },
    },
    // Hold short lines
    {
      forFeatureTypes: [FeatureType.TaxiwayHoldingPosition],
      styles: { doStroke: true, doFill: false, strokeStyle: '#ff2f00' },
    },
    // Stand guidance lines
    {
      forFeatureTypes: [FeatureType.StandGuidanceLine],
      styles: { doStroke: true, doFill: false, strokeStyle: '#ffff00', lineWidth: 1.85 },
    },
  ],
  2: [
    // Runway highlights (white fill for runways without markings)
    {
      forFeatureTypes: [
        FeatureType.RunwayElement,
        FeatureType.RunwayIntersection,
        FeatureType.RunwayDisplacedArea,
        FeatureType.Stopway,
      ],
      styles: { doStroke: false, doFill: true, fillStyle: '#ffffff' },
    },
  ],
  3: [
    // Dynamic overlay (BTV paths, user markers) - kept empty, populated at runtime
  ],
};
