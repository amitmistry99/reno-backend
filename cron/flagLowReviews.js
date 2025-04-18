import cron from 'node-cron'
import {prisma} from '../config/prisma.js'

// Run daily at 2:30 AM
cron.schedule('30 2 * * *', async () => {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - 1); // reviews older than 1 day

  try {
    const flagged = await prisma.review.updateMany({
      where: {
        rating: { lt: 3 },
        isFlagged: false,
        createdAt: { lt: cutoffDate },
      },
      data: {
        isFlagged: true,
      },
    });

    console.log(`[CRON] Flagged ${flagged.count} low-rated reviews as potential spam.`);
  } catch (error) {
    console.error('[CRON] Failed to flag reviews:', error.message);
  }
})