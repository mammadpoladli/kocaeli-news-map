let pipelineInstance = null;
let pipelineLoading = null;

async function getPipeline() {
    if (pipelineInstance) return pipelineInstance;

    if (pipelineLoading) return pipelineLoading;

    pipelineLoading = (async () => {
        console.log('🧠 Embedding modeli yükleniyor (paraphrase-multilingual-MiniLM-L12-v2)...');
        const startTime = Date.now();

        const { pipeline } = await import('@xenova/transformers');

        pipelineInstance = await pipeline(
            'feature-extraction',
            'Xenova/paraphrase-multilingual-MiniLM-L12-v2',
            {
                quantized: true,
            }
        );

        const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
        console.log(`✅ Embedding modeli yüklendi. (${elapsed} saniye)`);
        return pipelineInstance;
    })();

    return pipelineLoading;
}

async function getEmbedding(text) {
    if (!text || text.trim().length === 0) {
        return new Array(384).fill(0);
    }

    try {
        const extractor = await getPipeline();

        const truncatedText = text.substring(0, 1800);

        const output = await extractor(truncatedText, {
            pooling: 'mean',
            normalize: true,
        });

        return Array.from(output.data);
    } catch (error) {
        console.error('❌ Embedding hesaplama hatası:', error.message);
        return new Array(384).fill(0);
    }
}

function calculateCosineSimilarity(vecA, vecB) {
    if (!vecA || !vecB || vecA.length !== vecB.length) return 0;

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < vecA.length; i++) {
        dotProduct += vecA[i] * vecB[i];
        normA += vecA[i] * vecA[i];
        normB += vecB[i] * vecB[i];
    }

    if (normA === 0 || normB === 0) return 0;

    const similarity = dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
    return Math.min(1, Math.max(-1, similarity)) * 100;
}

module.exports = { getEmbedding, calculateCosineSimilarity };
