export { Graph3DScene, normalizeGraph3DSeries, GRAPH_3D_CHART_TYPES } from './Graph3DScene';
export type { Graph3DChartType, Graph3DRenderableData } from './Graph3DScene';
export { Terrain3DScene, TERRAIN_3D_CHART_TYPES } from './Terrain3DScene';
export type { Terrain3DChartType } from './Terrain3DScene';
export { Challenge3DScene, CHALLENGE_3D_CHART_TYPES } from './Challenge3DScene';
export type { Challenge3DChartType } from './Challenge3DScene';
import { GRAPH_3D_CHART_TYPES } from './Graph3DScene';
import { TERRAIN_3D_CHART_TYPES } from './Terrain3DScene';
import { CHALLENGE_3D_CHART_TYPES } from './Challenge3DScene';

/** Unified production registry used by the runtime, catalog, Builder, and docs. */
export const THREE_D_CHART_TYPES = [...new Set([
  ...GRAPH_3D_CHART_TYPES,
  ...TERRAIN_3D_CHART_TYPES,
  ...CHALLENGE_3D_CHART_TYPES,
])] as const;
export type Production3DChartType = typeof THREE_D_CHART_TYPES[number];
export { fetchOpenTopoPoints, parseAAIGrid, aaigridToPoints } from './openTopo';
export type { AAIGridData, OpenTopoGlobalDemType, OpenTopoUSGSDemType } from './openTopo';
