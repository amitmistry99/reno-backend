import { prisma } from '../config/prisma.js'


// CREATE
export const createCoupon = async (req, res) => {
    
    const { code, discount, type, maxDiscount, minOrder, expiry } = req.body
  
    try {
      const coupon = await prisma.coupon.create({
        data: {
          code: code.toUpperCase(),
          discount,
          type,
          maxDiscount,
          minOrder,
          expiry: new Date(expiry),
        },
      })
      res.status(201).json(coupon)
    } catch (err) {
      res.status(400).json({ error: 'Coupon creation failed', detail: err.message })
    }
}

// UPDATE
export const updateCoupon = async (req, res) => {
    const { id } = req.params
    const { code, discount, type, maxDiscount, minOrder, expiry, isActive } = req.body
  
    try {
      const updated = await prisma.coupon.update({
        where: { id },
        data: {
          code: code?.toUpperCase(),
          discount,
          type,
          maxDiscount,
          minOrder,
          expiry: expiry ? new Date(expiry) : undefined,
          isActive,
        },
      })
  
      res.json(updated)
    } catch (err) {
      res.status(400).json({ error: 'Coupon update failed', detail: err.message })
    }
}
  
// DELETE
export const deleteCoupon = async (req, res) => {
    try {
      await prisma.coupon.delete({ where: { id: req.params.id } })
      res.sendStatus(204)
    } catch (err) {
      res.status(400).json({ error: 'Coupon deletion failed' })
    }
}