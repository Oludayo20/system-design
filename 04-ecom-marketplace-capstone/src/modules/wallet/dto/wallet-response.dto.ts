import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { LedgerEntryType } from '../entities/wallet-ledger-entry.entity';

export class WalletDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  userId!: string;

  @ApiProperty({ example: 500000, description: 'Balance in minor currency units (kobo/cents).' })
  balanceCents!: number;

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty()
  updatedAt!: Date;
}

export class WalletLedgerEntryDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  walletId!: string;

  @ApiProperty({ enum: LedgerEntryType })
  type!: LedgerEntryType;

  @ApiProperty({ example: 300000 })
  amountCents!: number;

  @ApiProperty({ example: 'Order settlement' })
  reason!: string;

  @ApiPropertyOptional({ example: 'order-uuid' })
  referenceId!: string | null;

  @ApiProperty()
  createdAt!: Date;
}

export class WalletMeResponseDto {
  @ApiProperty({ type: WalletDto })
  wallet!: WalletDto;

  @ApiProperty({ type: [WalletLedgerEntryDto] })
  ledger!: WalletLedgerEntryDto[];
}
