import { Body, Controller, Get, Post } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ClusterService } from '../cluster/cluster.service';
import { DebitDto } from './dto/debit.dto';
import { PartitionDto } from './dto/partition.dto';
import {
  NodesResponseDto,
  PartitionResponseDto,
  ProductViewResponseDto,
  ReconcileResponseDto,
  WalletDebitAcceptedDto,
  WalletDebitRejectedDto,
} from './dto/cap-response.dto';

@ApiTags('cluster')
@Controller()
export class CapController {
  constructor(private readonly cluster: ClusterService) {}

  @Get('nodes')
  @ApiOperation({
    summary: 'Inspect both cluster nodes',
    description: 'Returns side-by-side state for nodes A and B, plus whether a partition is active.',
  })
  @ApiResponse({ status: 200, type: NodesResponseDto })
  nodes(): NodesResponseDto {
    return {
      partitioned: this.cluster.isPartitioned(),
      nodes: this.cluster.getNodes(),
    };
  }

  @Post('admin/partition')
  @ApiOperation({
    summary: 'Toggle network partition simulation',
    description:
      'When enabled, nodes A and B stop syncing. AP endpoints accept local writes; CP wallet debits are rejected.',
  })
  @ApiResponse({ status: 201, type: PartitionResponseDto })
  partition(@Body() body: PartitionDto): PartitionResponseDto {
    this.cluster.setPartitioned(body.enabled);
    return { partitioned: this.cluster.isPartitioned() };
  }

  @Post('profile/view')
  @ApiOperation({
    summary: 'Increment product view counter (AP)',
    description:
      '**Availability + Partition tolerance:** accepts the write on node A even during a partition. ' +
      'Node B may lag until reconciliation — showing 1,250 vs 1,251 views briefly is acceptable.',
  })
  @ApiResponse({ status: 201, type: ProductViewResponseDto })
  viewProduct(): ProductViewResponseDto {
    return this.cluster.incrementProductViews();
  }

  @Post('wallet/debit')
  @ApiOperation({
    summary: 'Debit wallet balance (CP)',
    description:
      '**Consistency + Partition tolerance:** rejects writes during a partition to avoid divergent balances. ' +
      'Also rejects when funds are insufficient.',
  })
  @ApiResponse({ status: 201, description: 'Debit accepted.', type: WalletDebitAcceptedDto })
  @ApiResponse({
    status: 201,
    description: 'Debit rejected (partition or insufficient funds).',
    type: WalletDebitRejectedDto,
  })
  debit(@Body() body: DebitDto) {
    return this.cluster.debitWallet(body.amount);
  }

  @Post('admin/reconcile')
  @ApiOperation({
    summary: 'Heal partition and sync nodes',
    description: 'Clears the partition flag and copies node A state to node B (eventual consistency catch-up).',
  })
  @ApiResponse({ status: 201, type: ReconcileResponseDto })
  reconcile(): ReconcileResponseDto {
    return this.cluster.reconcile();
  }
}
