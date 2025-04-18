import express from 'express'
import {addToCart, clearCart, applyCoupon, getCart, removeCartItem, updateCartItem} from '../controllers/cartController.js'
import {authMiddleware} from '../middleware/authMiddleware.js'

const router = express.Router()

// Protect all routes
router.use(authMiddleware)

// GET /api/v1/cart - Get user's cart
router.get('/', getCart)

// POST /api/v1/cart/items - Add item to cart
router.post('/items', addToCart)

// PATCH /api/v1/cart/items/:itemId - Update cart item
router.patch('/items/:itemId', updateCartItem)

// DELETE /api/v1/cart/items/:itemId - Remove item from cart
router.delete('/items/:itemId', removeCartItem)

// DELETE /api/v1/cart - Clear cart
router.delete('/', clearCart)

// POST /api/v1/cart/coupons - Apply coupon
router.post('/coupons', applyCoupon)

export default router