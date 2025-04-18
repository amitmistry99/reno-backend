import { prisma } from "../config/prisma.js"

// Get inventory by product ID
export const getInventory = async (req, res) => {
  try {
    const { productId } = req.params

    const inventory = await prisma.inventory.findUnique({
      where: { productId },
      include: {
        product: true,
        history: {
          orderBy: {
            createdAt: 'desc'
          },
          take: 10
        }
      }
    })

    if (!inventory) {
      return res.status(404).json({ error: 'Inventory not found' })
    }

    res.json(inventory)
  } catch (error) {
    console.error('Error fetching inventory:', error);
    res.status(500).json({ error: 'Failed to fetch inventory' })
  }
};

// Update stock levels
export const updateStock = async (req, res) => {
  try {
    const { productId } = req.params;
    const { change, type, reference, notes } = req.body

    // Validate input
    if (typeof change !== 'number') {
      return res.status(400).json({ error: 'Invalid change value' })
    }

    // Get current inventory
    const inventory = await prisma.inventory.findUnique({
      where: { productId }
    })

    if (!inventory) {
      return res.status(404).json({ error: 'Inventory not found' })
    }

    // Calculate new stock
    const newStock = inventory.stock + change
    if (newStock < 0) {
      return res.status(400).json({ error: 'Insufficient stock' })
    }

    // Update inventory in transaction
    const [updatedInventory] = await prisma.$transaction([
      prisma.inventory.update({
        where: { productId },
        data: { stock: newStock }
      }),
      prisma.inventoryHistory.create({
        data: {
          inventoryId: inventory.id,
          change,
          type,
          reference,
          notes
        }
      })
    ])

    // Update product status if needed
    if (newStock === 0) {
      await prisma.product.update({
        where: { id: productId },
        data: { status: 'OUT_OF_STOCK' }
      });
    } else if (newStock > 0 && inventory.stock === 0) {
      await prisma.product.update({
        where: { id: productId },
        data: { status: 'ACTIVE' }
      })
    }

    res.json(updatedInventory)
  } catch (error) {
    console.error('Error updating inventory:', error)
    res.status(500).json({ error: 'Failed to update inventory' })
  }
};

// Bulk update inventory
export const bulkUpdateInventory = async (req, res) => {
  try {
    const { updates } = req.body

    if (!Array.isArray(updates) || updates.length === 0) {
      return res.status(400).json({ error: 'Invalid updates array' })
    }

    // Process updates in transaction
    const results = await prisma.$transaction(async (tx) => {
      const updateResults = []
      
      for (const update of updates) {
        try {
          const { productId, change, type, reference, notes } = update

          // Get current inventory
          const inventory = await tx.inventory.findUnique({
            where: { productId }
          })

          if (!inventory) {
            updateResults.push({ productId, success: false, error: 'Inventory not found' })
            continue
          }

          // Calculate new stock
          const newStock = inventory.stock + change
          if (newStock < 0) {
            updateResults.push({ productId, success: false, error: 'Insufficient stock' })
            continue
          }

          // Update inventory
          await tx.inventory.update({
            where: { productId },
            data: { stock: newStock }
          })

          // Record history
          await tx.inventoryHistory.create({
            data: {
              inventoryId: inventory.id,
              change,
              type,
              reference,
              notes
            }
          })

          // Update product status if needed
          if (newStock === 0) {
            await tx.product.update({
              where: { id: productId },
              data: { status: 'OUT_OF_STOCK' }
            });
          } else if (newStock > 0 && inventory.stock === 0) {
            await tx.product.update({
              where: { id: productId },
              data: { status: 'ACTIVE' }
            })
          }

          updateResults.push({ productId, success: true, newStock })
        } catch (error) {
          updateResults.push({ 
            productId: update.productId, 
            success: false, 
            error: error.message 
          });
        }
      }

      return updateResults
    })

    res.json({ results })
  } catch (error) {
    console.error('Error during bulk inventory update:', error)
    res.status(500).json({ error: 'Failed to bulk update inventory' })
  }
};

// Get inventory history
export const getInventoryHistory = async (req, res) => {
  try {
    const { productId } = req.params
    const { page = 1, limit = 20, type, startDate, endDate } = req.query

    const skip = (Number(page) - 1) * Number(limit)
    const where = {
      inventory: { productId }
    };

    if (type) where.type = type
    if (startDate || endDate) {
      where.createdAt = {}
      if (startDate) where.createdAt.gte = new Date(startDate)
      if (endDate) where.createdAt.lte = new Date(endDate)
    }

    const [history, total] = await Promise.all([
      prisma.inventoryHistory.findMany({
        where,
        skip,
        take: Number(limit),
        orderBy: {
          createdAt: 'desc'
        },
        include: {
          inventory: {
            include: {
              product: {
                select: {
                  name: true,
                  sku: true
                }
              }
            }
          }
        }
      }),
      prisma.inventoryHistory.count({ where })
    ])

    res.json({
      data: history,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        pages: Math.ceil(total / Number(limit))
      }
    });
  } catch (error) {
    console.error('Error fetching inventory history:', error)
    res.status(500).json({ error: 'Failed to fetch inventory history' })
  }
}

// Get low stock alerts
export const getLowStockAlerts = async (req, res) => {
  try {
    const { threshold } = req.query
    const alertThreshold = threshold ? Number(threshold) : undefined

    const lowStockItems = await prisma.inventory.findMany({
      where: {
        stock: {
          lte: alertThreshold || { lte: prisma.inventory.fields.lowStock }
        }
      },
      include: {
        product: {
          select: {
            name: true,
            sku: true,
            price: true,
            status: true,
            images: {
              take: 1,
              select: {
                url: true
              }
            }
          }
        }
      },
      orderBy: {
        stock: 'asc'
      }
    })

    res.json(lowStockItems)
  } catch (error) {
    console.error('Error fetching low stock alerts:', error)
    res.status(500).json({ error: 'Failed to fetch low stock alerts' })
  }
}

// Set low stock threshold
export const setLowStockThreshold = async (req, res) => {
  try {
    const { productId } = req.params
    const { threshold } = req.body

    if (typeof threshold !== 'number' || threshold < 0) {
      return res.status(400).json({ error: 'Invalid threshold value' })
    }

    const updatedInventory = await prisma.inventory.update({
      where: { productId },
      data: { lowStock: threshold }
    })

    res.json(updatedInventory)
  } catch (error) {
    console.error('Error setting low stock threshold:', error)
    res.status(500).json({ error: 'Failed to set low stock threshold' })
  }
}