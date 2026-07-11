import { describe, expect, it } from 'vitest';

import * as Basic from '../../src/charts/basic';
import * as Advanced from '../../src/charts/advanced';
import * as ThreeD from '../../src/scenes';
import { BASIC_CHART_TYPES } from '../../src/charts/basic/supportedTypes';
import { ADVANCED_CHART_TYPES } from '../../src/charts/advanced/supportedTypes';
import { CHALLENGE_3D_CHART_TYPES, GRAPH_3D_CHART_TYPES, THREE_D_CHART_TYPES } from '../../src/scenes';

describe('chart family barrels', () => {
  it('keeps the basic barrel focused on day-to-day analytical charts', () => {
    expect(Basic.renderLineSeries).toBeTypeOf('function');
    expect(Basic.renderMapChart).toBeTypeOf('function');
    expect(Basic.renderWordCloud).toBeTypeOf('function');
    expect(Basic.renderBellCurve).toBeTypeOf('function');
    expect('renderSpectrumAnalyzer' in Basic).toBe(false);
    expect('renderNetwork3D' in Basic).toBe(false);
    expect('renderChart' in Basic).toBe(false);
  });

  it('keeps the advanced barrel focused on specialized analytical surfaces', () => {
    expect(Advanced.renderPolarChart).toBeTypeOf('function');
    expect(Advanced.renderSpectrumAnalyzer).toBeTypeOf('function');
    expect(Advanced.renderNetworkTopology).toBeTypeOf('function');
    expect('renderLineSeries' in Advanced).toBe(false);
    expect('renderMapChart' in Advanced).toBe(false);
    expect('renderNetwork3D' in Advanced).toBe(false);
  });

  it('keeps the 3d barrel tightly scoped to graph analysis surfaces', () => {
    expect(ThreeD.Graph3DScene).toBeTypeOf('function');
    expect(ThreeD.normalizeGraph3DSeries).toBeTypeOf('function');
    expect(GRAPH_3D_CHART_TYPES).toEqual(expect.arrayContaining([
      'graph3d',
      'alphaLaplacianGraph3d',
      'powerwalkGraph3d',
      'graphManifold3d',
    ]));
    expect('renderLineSeries' in ThreeD).toBe(false);
    expect('renderMapChart' in ThreeD).toBe(false);
    expect('renderSpectrumAnalyzer' in ThreeD).toBe(false);
  });

  it('publishes non-overlapping family type lists', () => {
    const basic = new Set<string>(BASIC_CHART_TYPES);
    const advanced = new Set<string>(ADVANCED_CHART_TYPES);
    const threeD = new Set<string>(GRAPH_3D_CHART_TYPES);

    for (const type of BASIC_CHART_TYPES) {
      expect(advanced.has(type)).toBe(false);
      expect(threeD.has(type)).toBe(false);
    }

    for (const type of ADVANCED_CHART_TYPES) {
      expect(basic.has(type)).toBe(false);
      expect(threeD.has(type)).toBe(false);
    }

    for (const type of GRAPH_3D_CHART_TYPES) {
      expect(basic.has(type)).toBe(false);
      expect(advanced.has(type)).toBe(false);
    }
  });

  it('publishes the seven predictive-mathematics 3D chart types', () => {
    expect(CHALLENGE_3D_CHART_TYPES).toEqual(expect.arrayContaining([
      'temporalGraphState3d',
      'alphaLaplacianGraph3d',
      'powerwalkGraph3d',
      'spectralSurface3d',
      'graphManifold3d',
      'forecastCone3d',
      'operationalSignalFusion3d',
    ]));
    expect(new Set(CHALLENGE_3D_CHART_TYPES).size).toBe(CHALLENGE_3D_CHART_TYPES.length);
  });

  it('publishes every deck-card chart in one production 3D registry', () => {
    const required = [
      'temporalGraphState3d', 'alphaLaplacianGraph3d', 'powerwalkGraph3d', 'spectralSurface3d',
      'graphManifold3d', 'forecastCone3d', 'forecastWeightedControl3d', 'signalConsolidation3d',
      'adaptiveFabricEvolution3d', 'marketRegimeSurface3d', 'weatherDisasterSignalMap3d',
      'raceOutcomeDistribution3d', 'anomalyDetectionField3d', 'threatSurface3d',
      'eventSequenceMap3d', 'behaviorDrift3d', 'transactionFlowAnomaly3d', 'controlEventTimeline3d',
      'deviceTelemetryLearning3d', 'operationalSignalFusion3d', 'adaptiveResourceUse3d',
      'decisionAdvantage3d', 'airGappedExecution3d', 'crossScaleIntelligence3d',
      'deviceFleetHealth3d', 'missionOutcomes3d',
    ];
    expect(THREE_D_CHART_TYPES).toEqual(expect.arrayContaining(required));
    expect(new Set(THREE_D_CHART_TYPES).size).toBe(THREE_D_CHART_TYPES.length);
  });
});
