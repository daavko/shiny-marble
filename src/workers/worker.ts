export function createWorker(workerCode: string): Worker {
    const workerBlob = new Blob([workerCode], { type: 'application/javascript' });
    const workerObjectURL = URL.createObjectURL(workerBlob);
    return new Worker(workerObjectURL);
}
