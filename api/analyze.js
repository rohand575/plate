// Vercel Function: POST /api/analyze. The logic lives in server/ so local dev can reuse it.
import { handleAnalyze } from '../server/analyze.js';

export default { fetch: handleAnalyze };
