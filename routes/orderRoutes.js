import express from'express'
import { authMiddleware } from '../middleware/authMiddleware.js'
import {createOrder, getUserOrders, getOrder, cancelOrder, getAllOrders, updateOrderStatus  } from '../controllers/productController.js'


const router = express.Router()

// Protect all routes
router.use(authMiddleware)

// Customer routes
router.post('/', createOrder)
router.get('/my-orders', getUserOrders)
router.get('/:id', getOrder)
router.patch('/:id/cancel', cancelOrder)

// Admin routes
router.use(authMiddleware) //change the middleware to give access to ADMIN only
router.get('/', getAllOrders)
router.patch('/:id/status', updateOrderStatus)

export default router