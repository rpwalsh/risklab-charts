/**
 * @module @risklab/charts/data
 * Data connectors — load from CSV, JSON, REST polling, WebSocket, SSE.
 */

export type { DataFeed, FieldMapper, CsvConnectorOptions, JsonConnectorOptions, RestConnectorOptions, WebSocketConnectorOptions, SseConnectorOptions } from './connectors';
export { parseCSV, fetchCSV, readCSVFile, fetchJSON, mapJSON, createRestConnector, createWebSocketConnector, createSseConnector } from './connectors';
