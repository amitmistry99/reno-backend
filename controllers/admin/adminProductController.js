import { prisma } from "../config/prisma.js"

export const createProduct = async (req, res, next) => {

    try {
       
      const { name, description, price, isNew, isOnSale, category, stock, images} = req.body
      const userId = req.user.userId

      // Validate required fields
      if (!name || !description || !price) {
        return res.status(400).json({ error: 'Missing required fields' })
      }

      // // Handle image uploads
      // const imageFiles = req.files as Express.Multer.File[];
      // const uploadedImages = await Promise.all(
      //   imageFiles.map(file => uploadToCloudinary(file.path, 'reno-decor/products'))
      // )

      // // Parse variants and dimensions if provided
      // const parsedVariants: ProductVariant[] = variants ? JSON.parse(variants) : []
      // const parsedDimensions: ProductDimensions = dimensions ? JSON.parse(dimensions) : null


      const product = await prisma.product.create({
        data: {
          name,
          description,
          price: parseFloat(price),
          // slug: generateSlug(name),
          // sku: generateSKU(),
          isNew,
          isOnSale,
          category,
          stock,
          images,
          user: {
              connect: { id: userId },
          },
        }
      })
  
      res.status(201).json({
        status: 'success',
        data: { product }
      })
    } catch (error) {
      console.error('[CREATE PRODUCT ERROR]', error);
      return res.status(500).json({ message: 'Something went wrong. Could not create product' })
    }
}

export const updateProduct = async (req, res, next) => {
    try {
      const product = await prisma.product.update({
        where: { id: req.params.id },
        data: req.body
      })
  
      res.status(200).json({
        status: 'success',
        data: { product }
      })
    } catch (err) {
      next(err)
    }
}

export const deleteProduct = async (req, res, next) => {
    try {
      await prisma.product.delete({
        where: { id: req.params.id }
      })
  
      res.status(204).json({
        status: 'success',
        data: null
      })
    } catch (err) {
      next(err)
    }
}

// Process return/refund
export const processRefund = async (req, res) => {
  try {
    const { id } = req.params;
    const { amount, reason, items } = req.body
    const adminId = req.user.id; // Assuming admin user is authenticated

    // Validate refund
    const order = await prisma.order.findUnique({
      where: { id },
      include: { items: true }
    });

    if (!order) {
      return res.status(404).json({ error: 'Order not found' })
    }

    if (order.status !== 'RETURNED' && order.status !== 'CANCELLED') {
      return res.status(400).json({ error: 'Order must be returned or cancelled before refund' })
    }

    // Process refund in transaction
    const refund = await prisma.$transaction(async (tx) => {
      // Create refund record
      const refund = await tx.refund.create({
        data: {
          orderId: id,
          amount: parseFloat(amount),
          reason,
          status: 'PROCESSED',
          processedBy: adminId,
          processedAt: new Date()
        }
      })

      // Update order payment status
      let paymentStatus = 'PARTIALLY_REFUNDED';
      if (refund.amount === order.total) {
        paymentStatus = 'REFUNDED'
      }

      await tx.order.update({
        where: { id },
        data: { paymentStatus }
      })

      // Restock items if needed
      if (items && items.length > 0) {
        await Promise.all(
          items.map(async (item) => {
            await tx.inventory.update({
              where: { productId: item.productId },
              data: { stock: { increment: item.quantity } }
            })
          })
        )
      }

      return refund
    })

    // Send refund confirmation to customer
    await sendRefundConfirmationEmail(order.userId, order.orderNumber, refund.amount);

    res.json(refund)
  } catch (error) {
    console.error('Error processing refund:', error);
    res.status(500).json({ error: 'Failed to process refund' })
  }
}


// Generate shipping label
export const generateLabel = async (req, res) => {
  try {
    const { id } = req.params;

    const order = await prisma.order.findUnique({
      where: { id },
      include: {
        user: true,
        items: {
          include: {
            product: true
          }
        }
      }
    })

    if (!order) {
      return res.status(404).json({ error: 'Order not found' })
    }

    // Generate shipping label (integrate with shipping provider API)
    const label = await generateShippingLabel(order);

    res.json({
      labelUrl: label.url,
      trackingNumber: label.trackingNumber,
      carrier: label.carrier,
      estimatedDelivery: label.estimatedDelivery
    });
  } catch (error) {
    console.error('Error generating shipping label:', error);
    res.status(500).json({ error: 'Failed to generate shipping label' })
  }
}

// Fulfillment tracking webhook
export const fulfillmentWebhook = async (req, res) => {
  try {
    const { orderId, status, trackingNumber, carrier, timestamp } = req.body

    // Verify webhook signature if needed
    // ...

    // Update order status
    const updatedOrder = await prisma.order.update({
      where: { orderNumber: orderId },
      data: {
        status,
        trackingNumber,
        shippingCarrier: carrier
      }
    })

    // Record in history
    await prisma.orderHistory.create({
      data: {
        orderId: updatedOrder.id,
        status,
        notes: `Updated via ${carrier} webhook`
      }
    })

    // Notify customer if shipped/delivered
    if (status === 'SHIPPED' || status === 'DELIVERED') {
      await sendOrderStatusEmail(
        updatedOrder.userId,
        updatedOrder.orderNumber,
        status,
        trackingNumber
      )
    }

    res.status(200).send('Webhook processed')
  } catch (error) {
    console.error('Error processing fulfillment webhook:', error)
    res.status(500).send('Failed to process webhook')
  }
}