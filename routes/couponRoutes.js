import express from 'express'
import {
  createCoupon,
  applyCoupon,
  getAllCoupons,
  getCoupon,
  updateCoupon,
  deleteCoupon,
} from '../controllers/couponController.js'

import { authMiddleware } from '../middleware/authMiddleware.js' 

const router = express.Router()

router.post('/apply', applyCoupon)
router.get('/:code', getCoupon)

router.use(authMiddleware)
router.post('/', createCoupon)
router.get('/', getAllCoupons)
router.put('/:id', updateCoupon)
router.delete('/:id', deleteCoupon)

export default router
