function getProjectId() {
  return process.env.GOOGLE_CLOUD_PROJECT;
}

function getRegion() {
  return process.env.GOOGLE_CLOUD_REGION || 'us-central1';
}
export default {
  getProjectId,
  getRegion
}; 