import { ApiProperty } from '@nestjs/swagger';

export class NodeSnapshotDto {
  @ApiProperty({ enum: ['A', 'B'], example: 'A' })
  name!: string;

  @ApiProperty({ example: 1250 })
  productViews!: number;

  @ApiProperty({ example: 5000 })
  walletBalance!: number;
}

export class NodesResponseDto {
  @ApiProperty({ example: false })
  partitioned!: boolean;

  @ApiProperty({ type: [NodeSnapshotDto] })
  nodes!: NodeSnapshotDto[];
}

export class PartitionResponseDto {
  @ApiProperty({ example: true })
  partitioned!: boolean;
}

export class ProductViewResponseDto {
  @ApiProperty({ example: true })
  accepted!: true;

  @ApiProperty({ enum: ['A', 'B'], example: 'A' })
  node!: string;

  @ApiProperty({ example: 1251 })
  views!: number;
}

export class WalletDebitAcceptedDto {
  @ApiProperty({ example: true })
  accepted!: true;

  @ApiProperty({ example: 4500 })
  balance!: number;
}

export class WalletDebitRejectedDto {
  @ApiProperty({ example: false })
  accepted!: false;

  @ApiProperty({
    example: 'Partition detected: wallet writes rejected to preserve consistency (CP)',
  })
  reason!: string;
}

export class ReconcileResponseDto {
  @ApiProperty({ example: 1251 })
  productViews!: number;

  @ApiProperty({ example: 4500 })
  walletBalance!: number;
}
