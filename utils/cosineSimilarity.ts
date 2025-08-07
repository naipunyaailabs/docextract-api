export function cosineSimilarity(vec1: number[], vec2: number[]): number {
    if (!Array.isArray(vec1) || !Array.isArray(vec2) || vec1.length !== vec2.length || vec1.length === 0) {
        throw new Error('Input vectors must be non-empty arrays of the same length');
    }
    const dot = vec1.reduce((sum, v, i) => sum + v * (vec2[i] ?? 0), 0);
    const mag1 = Math.sqrt(vec1.reduce((sum, v) => sum + v * v, 0));
    const mag2 = Math.sqrt(vec2.reduce((sum, v) => sum + v * v, 0));
    if (mag1 === 0 || mag2 === 0) {
        throw new Error('Cannot compute cosine similarity for zero magnitude vector');
    }
    return dot / (mag1 * mag2);
}