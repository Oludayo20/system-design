export interface CustomerPoints {
  customerId: string;
  points: number;
}

export interface PointsSummary {
  customers: CustomerPoints[];
  processedEventCount: number;
}
