import express from 'express'
import { createReview, deleteReview, getFlaggedReviews, getProductRatingStats, getProductReviews,getUserReviews, updateReview } from '../controllers/reviewController.js'
import { authMiddleware } from '../middleware/authMiddleware.js'

const router = express.Router()

// Public
router.get('/product/:productId', getProductReviews)
router.get('/product/:productId/stats', getProductRatingStats)

router.use(authMiddleware)

// Authenticated routes
router.post('/', createReview)
router.get('/my-reviews', getUserReviews)
router.get('/flagged', getFlaggedReviews)
router.put('/:id', updateReview)
router.delete('/:id', deleteReview)


export default router