import { prisma } from "../../config/prisma.js"
import { generatePDFInvoice } from '../../services/pdfService.js'
import { sendEmailWithAttachment } from '../../services/emailService.js'
import path from 'path'

// Generate and download invoice
export const generateInvoice = async (req, res, next) => {
  try {
    const orderId = parseInt(req.params.orderId);
    
    // Get order with all necessary relations
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        user: true,
        items: {
          include: {
            product: {
              select: {
                name: true,
                price: true,
                images: true
              }
            }
          }
        },
        address: true
      }
    })

    if (!order) {
      throw new AppError('Order not found', 404)
    }

    // Verify order belongs to user (or admin)
    if (order.userId !== req.user.id && req.user.role !== 'ADMIN') {
      throw new AppError('Not authorized to access this invoice', 403)
    }

    // Generate PDF invoice
    const fileName = `invoice-${order.id}-${Date.now()}.pdf`
    const filePath = path.join(__dirname, '../invoices', fileName)
    
    await generatePDFInvoice(order, filePath)

    // Send as download
    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader(
      'Content-Disposition',
      `attachment; filename=${fileName}`
    );

    const fileStream = fs.createReadStream(filePath)
    fileStream.pipe(res)

    // Clean up file after sending
    fileStream.on('end', () => {
      fs.unlink(filePath, (err) => {
        if (err) console.error('Error deleting invoice file:', err)
      });
    });

  } catch (err) {
    res.status(500).json({ error: 'Could not fetch reviews' })
  }
}

// Email invoice to customer
export const emailInvoice = async (req, res, next) => {
  try {
    const orderId = parseInt(req.params.orderId);
    
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        user: true,
        items: {
          include: {
            product: {
              select: {
                name: true,
                price: true
              }
            }
          }
        }
      }
    });

    if (!order) {
      throw new AppError('Order not found', 404)
    }

    // Generate PDF
    const fileName = `invoice-${order.id}.pdf`
    const filePath = path.join(__dirname, '../invoices', fileName)
    await generatePDFInvoice(order, filePath)

    // Send email
    await sendEmailWithAttachment({
      to: order.user.email,
      subject: `Your Invoice for Order #${order.id}`,
      text: `Attached is your invoice for order #${order.id}`,
      html: `<p>Thank you for your purchase! Attached is your invoice.</p>`,
      attachments: [{
        filename: fileName,
        path: filePath
      }]
    })

    // Clean up
    fs.unlinkSync(filePath)

    res.status(200).json({
      status: 'success',
      message: 'Invoice sent to customer email'
    });

  } catch (err) {
    res.status(500).json({ error: 'Could not fetch reviews' })
  }
}

// Get all invoices for a user
export const getUserInvoices = async (req, res, next) => {
  try {
    const invoices = await prisma.order.findMany({
      where: { userId: req.user.id },
      select: {
        id: true,
        totalAmount: true,
        status: true,
        createdAt: true,
        paymentMode: true
      },
      orderBy: { createdAt: 'desc' }
    })

    res.status(200).json({
      status: 'success',
      data: { invoices }
    })
  } catch (err) {
    res.status(500).json({ error: 'Could not fetch reviews' })
  }
}

// Admin: Generate bulk invoices
export const generateBulkInvoices = async (req, res, next) => {
  try {
    const { orderIds } = req.body
    
    if (!Array.isArray(orderIds)) {
      throw new AppError('Invalid order IDs', 400)
    }

    // Create zip file of invoices
    const zipFileName = `invoices-${Date.now()}.zip`
    const zipFilePath = path.join(__dirname, '../invoices', zipFileName)
    
    await generateBulkInvoicesZip(orderIds, zipFilePath)

    // Send zip file
    res.setHeader('Content-Type', 'application/zip')
    res.setHeader(
      'Content-Disposition',
      `attachment; filename=${zipFileName}`
    );

    const fileStream = fs.createReadStream(zipFilePath)
    fileStream.pipe(res)

    // Clean up
    fileStream.on('end', () => {
      fs.unlink(zipFilePath, (err) => {
        if (err) console.error('Error deleting zip file:', err)
      })
    })

  } catch (err) {
    res.status(500).json({ error: 'Could not fetch reviews' })
  }
}