export interface BasketLine {
  productId: string;
  name: string;
  unitPrice: number;
  quantity: number;
  lineTotal: number;
}

export interface BasketView {
  userId: string;
  items: BasketLine[];
  total: number;
}
