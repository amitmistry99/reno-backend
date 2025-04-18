import { prisma } from "../config/prisma.js"

export const getAllProducts = async (req, res, next) => {
  try {
      // Filtering
      const queryObj = { ...req.query };
      const excludedFields = ['page', 'sort', 'limit', 'fields']
      excludedFields.forEach(el => delete queryObj[el]);

      // Advanced filtering
      let queryStr = JSON.stringify(queryObj);
      queryStr = queryStr.replace(/\b(gte|gt|lte|lt)\b/g, match => `$${match}`)
      const where = JSON.parse(queryStr);

      // Build base query
      const queryOptions = {
          where,
      }

      // Sorting
      if (req.query.sort) {
          queryOptions.orderBy = req.query.sort.split(',').map(field => ({
              [field.replace('-', '')]: field.startsWith('-') ? 'desc' : 'asc'
          }))
      }

      // Pagination
      const page = req.query.page * 1 || 1;
      const limit = req.query.limit * 1 || 10;
      const skip = (page - 1) * limit;

      queryOptions.skip = skip
      queryOptions.take = limit

      // Execute query
      const products = await prisma.product.findMany(queryOptions)

      res.status(200).json({
          status: 'success',
          results: products.length,
          data: { products }
      });
  } catch (err) {
      next(err)
  }
}

export const getProduct = async (req, res, next) => {

    try {
      const product = await prisma.product.findUnique({
        where: { id: req.params.id },
        include: {
          reviews: true,
          inventory: true,
        }
      });
  
      if (!product) {
        return res.json({message: "product does not exist"})
      }
  
      res.status(200).json({
        status: 'success',
        data: { product }
      });
    } catch (err) {
      console.error('Error fetching product:', err)
      res.status(500).json({ error: 'Failed to fetch product' })
    }
}

// // Update Inventory
// export const updateInventory = async (req, res) => {
//   try {
//     const { id } = req.params;
//     const { stock, lowStock } = req.body

//     // Validate product exists
//     const product = await prisma.product.findUnique({
//       where: { id },
//       include: { inventory: true }
//     })

//     if (!product) {
//       return res.status(404).json({ error: 'Product not found' })
//     }

//     // Update inventory
//     const updatedInventory = await prisma.inventory.update({
//       where: { productId: id },
//       data: {
//         stock: stock ? parseInt(stock) : undefined,
//         lowStock: lowStock ? parseInt(lowStock) : undefined
//       }
//     })

//     // Update product status if stock reaches 0
//     if (updatedInventory.stock === 0) {
//       await prisma.product.update({
//         where: { id },
//         data: { status: 'OUT_OF_STOCK' }
//       })
//     } else if (product.status === 'OUT_OF_STOCK') {
//       await prisma.product.update({
//         where: { id },
//         data: { status: 'ACTIVE' }
//       })
//     }

//     res.json(updatedInventory)
//   } catch (error) {
//     console.error('Error updating inventory:', error)
//     res.status(500).json({ error: 'Failed to update inventory' })
//   }
// }

// // Bulk Import Products
// export const bulkImportProducts = async (req, res) => {
//   try {
//     const file = req.file
//     if (!file) {
//       return res.status(400).json({ error: 'No file uploaded' })
//     }

//     // Parse CSV/Excel file
//     const products = await parseImportFile(file.path)

//     // Process products in batches
//     const batchSize = 50
//     const results = []

//     for (let i = 0; i < products.length; i += batchSize) {
//       const batch = products.slice(i, i + batchSize)
//       const batchResults = await Promise.all(
//         batch.map(async (productData) => {
//           try {
//             const product = await prisma.product.create({
//               data: {
//                 name: productData.name,
//                 description: productData.description,
//                 slug: generateSlug(productData.name),
//                 sku: productData.sku || generateSKU(),
//                 price: parseFloat(productData.price),
//                 costPrice: productData.costPrice ? parseFloat(productData.costPrice) : null,
//                 status: productData.status || 'DRAFT',
//                 categoryId: productData.categoryId || null,
//                 variants: productData.variants || [],
//                 dimensions: productData.dimensions || null,
//                 materials: productData.materials ? productData.materials.split(',') : [],
//                 inventory: {
//                   create: {
//                     stock: parseInt(productData.stock) || 0,
//                     lowStock: parseInt(productData.lowStock) || 5
//                   }
//                 }
//               }
//             })
//             return { success: true, product };
//           } catch (error) {
//             return { success: false, error: error.message, data: productData };
//           }
//         })
//       );
//       results.push(...batchResults)
//     }

//     res.json({
//       success: true,
//       imported: results.filter(r => r.success).length,
//       failed: results.filter(r => !r.success).length,
//       results
//     });
//   } catch (error) {
//     console.error('Error during bulk import:', error);
//     res.status(500).json({ error: 'Failed to import products' });
//   }
// }

// // Bulk Export Products
// export const bulkExportProducts = async (req, res) => {
//   try {
//     const { format = 'csv', status } = req.query;

//     const products = await prisma.product.findMany({
//       where: status ? { status: status as string } : undefined,
//       include: {
//         inventory: true,
//         category: true
//       }
//     });

//     // Convert to desired format
//     let exportData;
//     if (format === 'json') {
//       exportData = JSON.stringify(products, null, 2);
//       res.setHeader('Content-Type', 'application/json');
//     } else {
//       // Convert to CSV
//       exportData = convertToCSV(products);
//       res.setHeader('Content-Type', 'text/csv');
//     }

//     res.setHeader('Content-Disposition', `attachment; filename=reno-decor-products-${Date.now()}.${format}`);
//     res.send(exportData);
//   } catch (error) {
//     console.error('Error exporting products:', error);
//     res.status(500).json({ error: 'Failed to export products' });
//   }
// }

// // Helper function to parse import file
// async function parseImportFile(filePath) {
//   // Implementation depends on your file parsing library
//   // Example using csv-parser:
//   const results: any[] = [];
//   return new Promise((resolve, reject) => {
//     fs.createReadStream(filePath)
//       .pipe(csv())
//       .on('data', (data) => results.push(data))
//       .on('end', () => resolve(results))
//       .on('error', reject);
//   });
// }

// // Helper function to convert to CSV
// function convertToCSV(data) {
//   const header = Object.keys(data[0]).join(',');
//   const rows = data.map(obj => 
//     Object.values(obj).map(val => 
//       typeof val === 'string' ? `"${val.replace(/"/g, '""')}"` : val
//     ).join(',')
//   );
//   return [header, ...rows].join('\n');
// }
