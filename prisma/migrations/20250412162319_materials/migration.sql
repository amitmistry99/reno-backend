-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_products" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "price" REAL NOT NULL,
    "isNew" BOOLEAN,
    "isOnSale" BOOLEAN,
    "category" TEXT NOT NULL,
    "colors" JSONB,
    "materials" JSONB,
    "stock" INTEGER NOT NULL DEFAULT 0,
    "productId" TEXT NOT NULL,
    "images" JSONB,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "products_productId_fkey" FOREIGN KEY ("productId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_products" ("category", "colors", "createdAt", "description", "id", "images", "isNew", "isOnSale", "materials", "name", "price", "productId", "stock", "updatedAt") SELECT "category", "colors", "createdAt", "description", "id", "images", "isNew", "isOnSale", "materials", "name", "price", "productId", "stock", "updatedAt" FROM "products";
DROP TABLE "products";
ALTER TABLE "new_products" RENAME TO "products";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
