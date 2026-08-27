export type PhotogrammetryWorkerStartRequest = {
  jobId: number;
  projectId: number;
  surveyId: number;
  photoKeys: string[];
  boundary: { west: number; south: number; east: number; north: number };
  options: {
    orthophotoResolutionCm: number;
    generateDsm: boolean;
    generateTiles: boolean;
    generateQualityReport: boolean;
    useExif: boolean;
  };
};

export type PhotogrammetryWorkerProgress = {
  taskUuid: string;
  status: "queued" | "processing" | "completed" | "failed" | "cancelled";
  progress: number;
  message?: string;
  outputs?: {
    orthophotoKey?: string;
    tilesBaseKey?: string;
    dsmKey?: string;
    reportKey?: string;
    bounds?: { west: number; south: number; east: number; north: number };
    crs?: string;
    gsdCm?: number;
    reprojectionErrorPx?: number;
  };
};

export interface PhotogrammetryWorkerClient {
  health(): Promise<{ healthy: boolean; message: string }>;
  start(request: PhotogrammetryWorkerStartRequest): Promise<{ taskUuid: string }>;
  progress(taskUuid: string): Promise<PhotogrammetryWorkerProgress>;
  cancel(taskUuid: string): Promise<void>;
}

/**
 * Intencionalmente desligado na aplicação web. A implementação real vive num
 * serviço privado separado com NodeODM/OpenDroneMap e credenciais próprias.
 * Isto impede qualquer fallback local que possa consumir CPU/RAM da app.
 */
export class UnconfiguredPhotogrammetryWorker implements PhotogrammetryWorkerClient {
  async health() {
    return { healthy: false, message: "Worker NodeODM privado ainda não configurado." };
  }

  async start(): Promise<{ taskUuid: string }> {
    throw new Error("Worker NodeODM privado ainda não configurado.");
  }

  async progress(): Promise<PhotogrammetryWorkerProgress> {
    throw new Error("Worker NodeODM privado ainda não configurado.");
  }

  async cancel(): Promise<void> {
    return;
  }
}

export const photogrammetryWorker: PhotogrammetryWorkerClient = new UnconfiguredPhotogrammetryWorker();
