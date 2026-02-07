// pages/api/analytics/summary.js
import { MessageOperations } from '../../../db/operations.ts';

export default async function handler(req, res) {
  try {
    const summary = await MessageOperations.getAnalyticsSummary();
    res.status(200).json(summary);
  } catch (err) {
    console.error('Analytics error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
}
