import { prisma } from '../config/prisma.js'

// APPLY
export const applyCoupon = async (req, res) => {
    const { code, cartTotal } = req.body
  
    try {
      const coupon = await prisma.coupon.findUnique({
        where: { code: code.toUpperCase() },
      })
  
      if (!coupon || !coupon.isActive || new Date(coupon.expiry) < new Date()) {
        return res.status(400).json({ error: 'Invalid or expired coupon' })
      }
  
      if (coupon.minOrder && cartTotal < coupon.minOrder) {
        return res.status(400).json({ error: `Minimum order ₹${coupon.minOrder} required` })
      }
  
      let discountValue = 0
  
      if (coupon.type === 'FLAT') {
        discountValue = coupon.discount
      } else if (coupon.type === 'PERCENTAGE') {
        discountValue = (cartTotal * coupon.discount) / 100
        if (coupon.maxDiscount && discountValue > coupon.maxDiscount) {
          discountValue = coupon.maxDiscount
        }
      }
  
      const finalAmount = Math.max(cartTotal - discountValue, 0)
  
      res.json({
        success: true,
        discount: discountValue,
        finalAmount,
        message: `Coupon applied successfully`,
      })
    } catch (err) {
      res.status(500).json({ error: 'Failed to apply coupon' })
    }
}
  
// GET ALL
export const getAllCoupons = async (req, res) => {
    try {
      const coupons = await prisma.coupon.findMany({ orderBy: { createdAt: 'desc' } })
      res.json(coupons)
    } catch (err) {
      res.status(500).json({ error: 'Failed to fetch coupons' })
    }
}
  
// GET SINGLE
export const getCoupon = async (req, res) => {
    try {
      const coupon = await prisma.coupon.findUnique({
        where: { code: req.params.code.toUpperCase() },
      })
  
      if (!coupon) return res.status(404).json({ error: 'Coupon not found' })
      res.json(coupon)
    } catch (err) {
      res.status(500).json({ error: 'Failed to get coupon' })
    }
}
  
