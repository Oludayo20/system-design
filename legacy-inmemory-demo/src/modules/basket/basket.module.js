/**
 * Basket module - doc.md: "Add to Cart, Remove from Cart, Cart Totals, Coupons."
 * It reads product info from Catalog through a public function call, never by
 * reaching into Catalog's table directly - that's the module boundary.
 */
export function createBasketModule({ db, catalog }) {
  async function addToCart(userId, productId, qty = 1) {
    const product = catalog.listProducts().find((p) => p.id === productId);
    if (!product) {
      const err = new Error('Product not found');
      err.statusCode = 404;
      throw err;
    }

    let cart = await db.find('carts', (c) => c.userId === userId);
    if (!cart) {
      cart = { userId, items: [] };
      await db.insert('carts', cart);
    }
    cart.items.push({ productId, qty, price: product.price, name: product.name });
    console.log(`[Basket] user #${userId} added ${qty}x "${product.name}" to cart`);
    return cart;
  }

  async function getCart(userId) {
    return (await db.find('carts', (c) => c.userId === userId)) || { userId, items: [] };
  }

  async function getTotal(userId) {
    const cart = await getCart(userId);
    return cart.items.reduce((sum, item) => sum + item.price * item.qty, 0);
  }

  return { addToCart, getCart, getTotal };
}
