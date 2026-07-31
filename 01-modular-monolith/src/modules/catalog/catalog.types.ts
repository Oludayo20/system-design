/**
 * The only shape of Catalog data other modules are allowed to see. Basket and Ordering depend
 * on this interface (via CatalogService.getProductForOrder), never on the Product entity or the
 * `catalog.products` table directly.
 */
export interface ProductForOrder {
  id: string;
  name: string;
  price: number;
  stock: number;
}
