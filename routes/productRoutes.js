import express from'express'
import {getAllProducts,getProduct, createProduct, updateProduct, deleteProduct } from '../controllers/productController.js'
import { authMiddleware } from '../middleware/authMiddleware.js'

const router = express.Router()

// Public routes
router.get('/', getAllProducts)
router.get('/:id', getProduct)

// Protected routes (require authentication)
router.use(authMiddleware)

// Admin-only routes
// router.use(authMiddleware.restrictTo('admin'))

router.post('/', createProduct)
router.patch('/:id', updateProduct)
router.delete('/:id', deleteProduct)

export default router