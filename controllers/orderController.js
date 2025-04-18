import { prisma } from "../config/prisma.js"
import emailService from '../services/emailService'

// Create new order
export const createOrder = async (req, res, next) => {

    try {

      const { items, addressId, paymentMode } = req.body
      const userId = req.user.id
  
      // 1. Verify products and calculate total
      const productIds = items.map(item => item.productId)
      const products = await prisma.product.findMany({
        where: { id: { in: productIds }}
      })
  
      let totalAmount = 0
      const orderItems = items.map(item => {
        const product = products.find(p => p.id === item.productId)
        if (!product) throw new AppError(`Product ${item.productId} not found`, 404)
        if (product.stock < item.quantity) {
          throw new AppError(`Insufficient stock for ${product.name}`, 400)
        }
  
        totalAmount += product.price * item.quantity;
        return {
          productId: item.productId,
          quantity: item.quantity,
          price: product.price
        }
      })
  
      // 2. Create order
      const order = await prisma.$transaction(async (tx) => {
        // Update product stocks
        await Promise.all(items.map(item =>
          tx.product.update({
            where: { id: item.productId },
            data: { stock: { decrement: item.quantity } }
          })
        ))
  
        return tx.order.create({
          data: {
            userId,
            addressId,
            paymentMode,
            totalAmount,
            items: { create: orderItems }
          },
          include: {
            items: { include: { product: true } },
            address: true
          }
        })
      })
  
      // 3. Send confirmation email
      await emailService.sendOrderConfirmation(order, req.user)
  
      res.status(201).json({
        status: 'success',
        data: { order }
      });
    } catch (err) {
      next(err)
    }
}

// Get user's orders
export const getUserOrders = async (req, res, next) => {

    try {
      const orders = await prisma.order.findMany({
        where: { userId: req.user.id },
        include: {
          items: { include: { product: { select: { name: true, images: true }}}},
          address: true
        },
        orderBy: { createdAt: 'desc' }
      });
  
      res.status(200).json({
        status: 'success',
        results: orders.length,
        data: { orders }
      })
    } catch (err) {
      next(err)
    }
}
  
// Get order by ID
export const getOrder = async (req, res, next) => {
    try {
      const order = await prisma.order.findUnique({
        where: { id: parseInt(req.params.id) },
        include: {
          items: { include: { product: true } },
          address: true,
          user: true
        }
      })
  
      if (!order) return next(new AppError('Order not found', 404))
      if (order.userId !== req.user.id && req.user.role !== 'ADMIN') {
        return next(new AppError('Not authorized', 403))
      }
  
      res.status(200).json({
        status: 'success',
        data: { order }
      });
    } catch (err) {
      next(err);
    }
}
  
// Cancel order
export const cancelOrder = async (req, res, next) => {
    try {
      const order = await prisma.order.findUnique({
        where: { id: parseInt(req.params.id) },
        include: { items: true }
      })
  
      if (!order) return next(new AppError('Order not found', 404))
      if (order.userId !== req.user.id) return next(new AppError('Not authorized', 403))
      if (order.status !== 'PENDING') {
        return next(new AppError('Order cannot be cancelled at this stage', 400))
      }
  
      // Restore product stock
      await prisma.$transaction([
        ...order.items.map(item =>
          prisma.product.update({
            where: { id: item.productId },
            data: { stock: { increment: item.quantity } }
          })
        ),
        prisma.order.update({
          where: { id: order.id },
          data: { status: 'CANCELLED' }
        })
      ]);
  
      res.status(200).json({
        status: 'success',
        message: 'Order cancelled successfully'
      });
    } catch (err) {
      next(err)
    }
}