-- CreateTable
CREATE TABLE "users" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "nama" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'owner',
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "categories" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "nama_kategori" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "suppliers" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "nama" TEXT NOT NULL,
    "kontak" TEXT,
    "alamat" TEXT
);

-- CreateTable
CREATE TABLE "spareparts" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "kode_item" TEXT NOT NULL,
    "nama" TEXT NOT NULL,
    "category_id" INTEGER,
    "satuan" TEXT,
    "harga_beli" INTEGER NOT NULL DEFAULT 0,
    "harga_jual" INTEGER NOT NULL DEFAULT 0,
    "stok_saat_ini" INTEGER NOT NULL DEFAULT 0,
    "stok_minimum" INTEGER NOT NULL DEFAULT 5,
    CONSTRAINT "spareparts_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "customers" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "nama" TEXT,
    "no_hp" TEXT,
    "plat_motor" TEXT,
    "model_motor" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "service_types" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "nama_layanan" TEXT NOT NULL,
    "harga_jasa" INTEGER NOT NULL DEFAULT 0
);

-- CreateTable
CREATE TABLE "service_orders" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "nomor_order" TEXT NOT NULL,
    "customer_id" INTEGER,
    "user_id" INTEGER NOT NULL,
    "tanggal_masuk" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status_order" TEXT NOT NULL DEFAULT 'menunggu',
    "keluhan" TEXT,
    "mekanik" TEXT,
    "total_jasa" INTEGER NOT NULL DEFAULT 0,
    "total_sparepart" INTEGER NOT NULL DEFAULT 0,
    "total_keseluruhan" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "service_orders_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "service_orders_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "service_order_items" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "service_order_id" INTEGER NOT NULL,
    "tipe_item" TEXT NOT NULL,
    "spare_part_id" INTEGER,
    "service_type_id" INTEGER,
    "qty" INTEGER NOT NULL DEFAULT 1,
    "harga_satuan" INTEGER NOT NULL,
    "subtotal" INTEGER NOT NULL,
    CONSTRAINT "service_order_items_service_order_id_fkey" FOREIGN KEY ("service_order_id") REFERENCES "service_orders" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "service_order_items_spare_part_id_fkey" FOREIGN KEY ("spare_part_id") REFERENCES "spareparts" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "service_order_items_service_type_id_fkey" FOREIGN KEY ("service_type_id") REFERENCES "service_types" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "stock_movements" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "spare_part_id" INTEGER NOT NULL,
    "supplier_id" INTEGER,
    "service_order_id" INTEGER,
    "tipe" TEXT NOT NULL,
    "jumlah" INTEGER NOT NULL,
    "tanggal" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "keterangan" TEXT,
    CONSTRAINT "stock_movements_spare_part_id_fkey" FOREIGN KEY ("spare_part_id") REFERENCES "spareparts" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "stock_movements_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "suppliers" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "stock_movements_service_order_id_fkey" FOREIGN KEY ("service_order_id") REFERENCES "service_orders" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "payments" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "service_order_id" INTEGER NOT NULL,
    "tanggal_bayar" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "jumlah_bayar" INTEGER NOT NULL,
    "metode_bayar" TEXT,
    CONSTRAINT "payments_service_order_id_fkey" FOREIGN KEY ("service_order_id") REFERENCES "service_orders" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "expenses" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "kategori" TEXT NOT NULL,
    "keterangan" TEXT,
    "jumlah" INTEGER NOT NULL,
    "tanggal" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "settings" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT DEFAULT 1,
    "nama_bengkel" TEXT NOT NULL DEFAULT 'Bengkel Motor',
    "alamat" TEXT,
    "telepon" TEXT,
    "footer_nota" TEXT
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "categories_nama_kategori_key" ON "categories"("nama_kategori");

-- CreateIndex
CREATE UNIQUE INDEX "spareparts_kode_item_key" ON "spareparts"("kode_item");

-- CreateIndex
CREATE UNIQUE INDEX "service_orders_nomor_order_key" ON "service_orders"("nomor_order");

-- CreateIndex
CREATE INDEX "service_orders_status_order_idx" ON "service_orders"("status_order");

-- CreateIndex
CREATE INDEX "service_orders_tanggal_masuk_idx" ON "service_orders"("tanggal_masuk");

-- CreateIndex
CREATE INDEX "stock_movements_spare_part_id_idx" ON "stock_movements"("spare_part_id");

-- CreateIndex
CREATE INDEX "stock_movements_tanggal_idx" ON "stock_movements"("tanggal");

-- CreateIndex
CREATE INDEX "payments_tanggal_bayar_idx" ON "payments"("tanggal_bayar");

-- CreateIndex
CREATE INDEX "expenses_tanggal_idx" ON "expenses"("tanggal");
