import { pipeline } from '@xenova/transformers';

function cosineSimilarity(vecA, vecB) {
  let dotProduct = 0.0;
  let normA = 0.0;
  let normB = 0.0;
  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] ** 2;
    normB += vecB[i] ** 2;
  }
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

async function run() {
  const extractor = await pipeline('feature-extraction', 'Xenova/paraphrase-multilingual-MiniLM-L12-v2');
  
  const text1 = `KO-MEK, 12 ilçede sergi programlarını belirledi; “Biz Birlikte Türkiye’yiz” temalı ilçe sergileri başlıyor\nKÜLTÜREL YOLCULUĞA HAZIR OLUN KO-MEK kursiyerlerinin yıl boyunca büyük emek vererek hazırladığı el emeği göz nuru ürünler, bu yıl Türkiye’nin 7 bölgesinin tarihi ve kültürel özelliklerini yansıtacak şekilde ziyaretçilerin beğenisine sunulacak.`;
  const text2 = `“Biz Birlikte Türkiye’yiz” temalı ilçe sergileri başlıyor\nKÜLTÜREL YOLCULUĞA HAZIR OLUNKO-MEK kursiyerlerinin yıl boyunca büyük emek vererek hazırladığı el emeği göz nuru ürünler, bu yıl Türkiye’nin 7 bölgesinin tarihi ve kültürel özelliklerini yansıtacak şekilde ziyaretçilerin beğenisine sunulacak.`;

  const output1 = await extractor(text1, { pooling: 'mean', normalize: true });
  const output2 = await extractor(text2, { pooling: 'mean', normalize: true });

  const sim = cosineSimilarity(Array.from(output1.data), Array.from(output2.data));
  console.log("SIMILARITY KO-MEK:", sim);
}
run();
