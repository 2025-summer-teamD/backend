import pkg from '@google-cloud/aiplatform';
const { IndexEndpointServiceClient } = pkg.v1;

const indexEndpointServiceClient = new IndexEndpointServiceClient({
  projectId: process.env.GOOGLE_CLOUD_PROJECT,
  apiEndpoint: `${process.env.GOOGLE_CLOUD_REGION || 'us-central1'}-aiplatform.googleapis.com`,
});

// 실제 endpoint, deployedIndexId 등은 환경에 맞게 수정 필요
const INDEX_ENDPOINT = 'projects/' + process.env.GOOGLE_CLOUD_PROJECT + '/locations/' + (process.env.GOOGLE_CLOUD_REGION || 'us-central1') + '/indexEndpoints/INDEX_ENDPOINT_ID';
const DEPLOYED_INDEX_ID = 'DEPLOYED_INDEX_ID';

async function runRag(embedding) {
  // embedding: 임베딩 벡터 (Array<number>)
  const [response] = await indexEndpointServiceClient.findNeighbors({
    indexEndpoint: INDEX_ENDPOINT,
    deployedIndexId: DEPLOYED_INDEX_ID,
    queries: [
      {
        datapoint: {
          featureVector: embedding,
        },
        neighborCount: 5,
      },
    ],
  });
  return response;
}

export { runRag }; 