import { prisma } from "../config/prisma.js"

// Update order status (Admin only)
export const updateOrderStatus = async (req, res, next) => {
    try {
      const { status } = req.body
      const order = await prisma.order.update({
        where: { id: parseInt(req.params.id) },
        data: { status },
        include: { user: true }
      })
  
      // Send status update email
      if (status === 'SHIPPED') {
        await emailService.sendShippingUpdate(
          order, 
          order.user,
          req.body.trackingNumber
        )
      }
  
      res.status(200).json({
        status: 'success',
        data: { order }
      })
    } catch (err) {
      next(err)
    }
}

// Admin: Get all orders
export const getAllOrders = async (req, res, next) => {
    try {
      // Filtering (status, date range)
      const where = {}
      if (req.query.status) where.status = req.query.status
      if (req.query.startDate && req.query.endDate) {
        where.createdAt = {
          gte: new Date(req.query.startDate),
          lte: new Date(req.query.endDate)
        }
      }
  
      const orders = await prisma.order.findMany({
        where,
        include: {
          user: { select: { name: true, email: true } },
          items: { include: { product: { select: { name: true }}}}
        },
        orderBy: { createdAt: 'desc' }
      })
  
      res.status(200).json({
        status: 'success',
        results: orders.length,
        data: { orders }
      })
    } catch (err) {
      next(err)
    }
}