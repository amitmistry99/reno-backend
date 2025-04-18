import PDFDocument from 'pdfkit'
import fs from 'fs'

export const generatePDFInvoice = async (order, filePath) => {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 50 })

    // Create write stream
    const stream = fs.createWriteStream(filePath)
    doc.pipe(stream)

    // Header
    doc.image('public/logo.png', 50, 45, { width: 50 })
    doc.fontSize(20).text('Reno Decor', 110, 57)
    doc.fontSize(10)
      .text('123 Furniture St.', 110, 80)
      .text(`Invoice #: ${order.id}`, { align: 'right' })
      .text(`Date: ${new Date(order.createdAt).toLocaleDateString()}`, { align: 'right' })

    // Customer Info
    doc.text(`Bill To:`, 50, 150)
      .text(order.user.name, 50, 165)
      .text(order.address.street, 50, 180)
      .text(`${order.address.city}, ${order.address.state} ${order.address.postalCode}`, 50, 195)

    // Invoice items table
    let y = 250
    doc.font('Helvetica-Bold')
    doc.text('Description', 50, y)
    doc.text('Unit Price', 300, y, { width: 90, align: 'right' })
    doc.text('Quantity', 400, y, { width: 90, align: 'right' })
    doc.text('Amount', 500, y, { align: 'right' })
    doc.font('Helvetica')

    // Items
    order.items.forEach(item => {
      y += 25
      doc.text(item.product.name, 50, y);
      doc.text(`$${item.price.toFixed(2)}`, 300, y, { width: 90, align: 'right' })
      doc.text(item.quantity.toString(), 400, y, { width: 90, align: 'right' })
      doc.text(`$${(item.price * item.quantity).toFixed(2)}`, 500, y, { align: 'right' })
    })

    // Total
    y += 40
    doc.font('Helvetica-Bold');
    doc.text('Subtotal', 400, y, { width: 90, align: 'right' })
    doc.text(`$${order.totalAmount.toFixed(2)}`, 500, y, { align: 'right' })

    y += 25
    doc.text('Shipping', 400, y, { width: 90, align: 'right' })
    doc.text('$0.00', 500, y, { align: 'right' });

    y += 25;
    doc.text('Total', 400, y, { width: 90, align: 'right' })
    doc.text(`$${order.totalAmount.toFixed(2)}`, 500, y, { align: 'right' })

    // Footer
    doc.fontSize(10)
      .text('Thank you for your business!', 50, 700)
      .text('Terms: Payment due within 15 days', 50, 715)

    doc.end();
    stream.on('finish', resolve);
    stream.on('error', reject);
  })
}

export const generateBulkInvoicesZip = async (orderIds, zipFilePath) => {
  const archiver = require('archiver')
  const output = fs.createWriteStream(zipFilePath)
  const archive = archiver('zip', { zlib: { level: 9 }})

  return new Promise((resolve, reject) => {
    output.on('close', resolve)
    archive.on('error', reject)

    archive.pipe(output)

    // Add each invoice to the zip
    orderIds.forEach(async (orderId) => {
      const order = await prisma.order.findUnique({
        where: { id: orderId },
        include: { user: true, items: { include: { product: true }}}
      })

      if (order) {
        const pdfFileName = `invoice-${order.id}.pdf`
        const pdfPath = path.join(__dirname, '../temp', pdfFileName)
        
        await generatePDFInvoice(order, pdfPath)
        archive.file(pdfPath, { name: pdfFileName })
        
        // Delete temp file after adding to archive
        fs.unlinkSync(pdfPath)
      }
    })

    archive.finalize()
  })
}