import { prisma } from '../config/prisma.js'

// Get user's cart
export const getCart = async (req, res) => {
  try {
    const cart = await prisma.cart.findUnique({
      where: { userId: req.user.id },
      include: {
        items: {
          include: {
            product: {
              select: {
                id: true,
                name: true,
                price: true,
                images: true,
                stock: true
              }
            }
          }
        }
      }
    })

    if (!cart || cart.items.length === 0) {
      return res.status(200).json({
        status: 'success',
        data: { cart: null, summary: null }
      })
    }

    // Calculate totals
    const summary = cart.items.reduce(
      (acc, item) => {
        if (item.selected) {
          acc.itemsCount += item.quantity
          acc.productsCount += 1
          acc.subtotal += item.product.price * item.quantity
        }
        return acc
      },
      { itemsCount: 0, productsCount: 0, subtotal: 0 }
    )

    res.status(200).json({
      status: 'success',
      data: { cart, summary }
    });
  } catch (err) {
    return res.status(500).json({ message: 'Something went wrong. Could not create product' })
  }
}

// Add item to cart
export const addToCart = async (req, res, next) => {
  try {
    const { productId, quantity = 1 } = req.body

    // Verify product exists and has stock
    const product = await prisma.product.findUnique({
      where: { id: productId }
    })

    if (!product) {
      return next(new AppError('Product not found', 404))
    }

    if (product.stock < quantity) {
      return next(
        new AppError(
          `Only ${product.stock} units available for ${product.name}`,
          400
        )
      )
    }

    // Get or create user's cart
    let cart = await prisma.cart.findUnique({
      where: { userId: req.user.id }
    })

    if (!cart) {
      cart = await prisma.cart.create({
        data: { userId: req.user.id }
      })
    }

    // Add or update item
    const existingItem = await prisma.cartItem.findFirst({
      where: { cartId: cart.id, productId }
    })

    if (existingItem) {
      // Update quantity if already in cart
      await prisma.cartItem.update({
        where: { id: existingItem.id },
        data: { quantity: existingItem.quantity + quantity }
      });
    } else {
      // Add new item
      await prisma.cartItem.create({
        data: {
          cartId: cart.id,
          productId,
          quantity
        }
      })
    }

    res.status(200).json({
      status: 'success',
      message: 'Item added to cart'
    })
  } catch (err) {
    return res.status(500).json({ message: 'Something went wrong. Could not create product' })
  }
}

// Update cart item
export const updateCartItem = async (req, res, next) => {
  try {
    const { quantity, selected } = req.body

    const cartItem = await prisma.cartItem.findUnique({
      where: { id: req.params.itemId },
      include: { cart: true, product: true }
    })

    if (!cartItem) {
      return next(new AppError('Cart item not found', 404))
    }

    // Verify cart belongs to user
    if (cartItem.cart.userId !== req.user.id) {
      return next(new AppError('Not authorized', 403))
    }

    // Verify stock if increasing quantity
    if (quantity && quantity > cartItem.quantity) {
      const available = cartItem.product.stock
      if (available < quantity) {
        return next(
          new AppError(
            `Only ${available} units available for ${cartItem.product.name}`,
            400
          )
        )
      }
    }

    await prisma.cartItem.update({
      where: { id: cartItem.id },
      data: {
        quantity: quantity !== undefined ? quantity : cartItem.quantity,
        selected: selected !== undefined ? selected : cartItem.selected
      }
    })

    res.status(200).json({
      status: 'success',
      message: 'Cart item updated'
    })
  } catch (err) {
    return res.status(500).json({ message: 'Something went wrong. Could not create product' })
  }
}

// Remove item from cart
export const removeCartItem = async (req, res, next) => {
  try {
    const cartItem = await prisma.cartItem.findUnique({
      where: { id: parseInt(req.params.itemId) },
      include: { cart: true }
    })

    if (!cartItem) {
      return next(new AppError('Cart item not found', 404))
    }

    if (cartItem.cart.userId !== req.user.id) {
      return next(new AppError('Not authorized', 403))
    }

    await prisma.cartItem.delete({
      where: { id: cartItem.id }
    })

    res.status(204).json({
      status: 'success',
      data: null
    })
  } catch (err) {
    return res.status(500).json({ message: 'Something went wrong. Could not create product' })
  }
}

// Clear cart
export const clearCart = async (req, res, next) => {
  try {
    const cart = await prisma.cart.findUnique({
      where: { userId: req.user.id }
    })

    if (!cart) {
      return next(new AppError('Cart not found', 404))
    }

    await prisma.cartItem.deleteMany({
      where: { cartId: cart.id }
    });

    res.status(204).json({
      status: 'success',
      data: null
    });
  } catch (err) {
    return res.status(500).json({ message: 'Something went wrong. Could not create product' })
  }
}

// Apply coupon to cart
export const applyCoupon = async (req, res, next) => {
  try {
    const { code } = req.body

    // Verify coupon validity
    const coupon = await prisma.coupon.findUnique({
      where: { code },
      include: { products: true }
    });

    if (!coupon || coupon.expiresAt < new Date()) {
      return next(new AppError('Invalid or expired coupon', 400))
    }

    // Get user's cart with items
    const cart = await prisma.cart.findUnique({
      where: { userId: req.user.id },
      include: { items: { include: { product: true } }}
    })

    if (!cart || cart.items.length === 0) {
      return next(new AppError('Cart is empty', 400))
    }

    // Check if coupon applies to any cart items
    const applicableItems = coupon.products.length === 0
      ? cart.items // Applies to all products
      : cart.items.filter(item =>
          coupon.products.some(p => p.id === item.productId)
        );

    if (applicableItems.length === 0) {
      return next(
        new AppError('Coupon not applicable to any cart items', 400)
      )
    }

    // Calculate discount
    const subtotal = applicableItems.reduce(
      (sum, item) => sum + (item.product.price * item.quantity),
      0
    )

    const discount = coupon.discountType === 'PERCENTAGE'
      ? subtotal * (coupon.discountValue / 100)
      : Math.min(coupon.discountValue, subtotal)

    res.status(200).json({
      status: 'success',
      data: {
        coupon: {
          code: coupon.code,
          discount,
          discountType: coupon.discountType,
          discountValue: coupon.discountValue
        },
        applicableItems: applicableItems.map(i => i.productId)
      }
    });
  } catch (err) {
    return res.status(500).json({ message: 'Something went wrong. Could not create product' })
  }
}