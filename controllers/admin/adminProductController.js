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