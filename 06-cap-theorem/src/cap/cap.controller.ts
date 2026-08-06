import { Body, Controller, Get, Post } from '@nestjs/common';
import {
  ApiBody,
  ApiExtraModels,
  ApiOperation,
  ApiResponse,
  ApiTags,
  getSchemaPath,
} from '@nestjs/swagger';
import { ApiServerError, ApiValidationErrors } from '../common/swagger/api-error.decorators';
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
@ApiExtraModels(WalletDebitAcceptedDto, WalletDebitRejectedDto)
@Controller()
export class CapController {
  constructor(private readonly cluster: ClusterService) {}

  @Get('nodes')
  @ApiOperation({
    summary: 'Inspect both cluster nodes',
    description: 'Returns side-by-side state for nodes A and B, plus whether a partition is active.',
  })
  @ApiResponse({ status: 200, type: NodesResponseDto })
  @ApiServerError()
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
  @ApiBody({ type: PartitionDto })
  @ApiResponse({ status: 201, type: PartitionResponseDto })
  @ApiValidationErrors()
  @ApiServerError()
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
  @ApiServerError()
  viewProduct(): ProductViewResponseDto {
    return this.cluster.incrementProductViews();
  }

  @Post('wallet/debit')
  @ApiOperation({
    summary: 'Debit wallet balance (CP)',
    description:
      '**Consistency + Partition tolerance:** rejects writes during a partition to avoid divergent balances. ' +
      'Also rejects when funds are insufficient. Returns `accepted: true` with updated balance, or `accepted: false` with a reason.',
  })
  @ApiBody({ type: DebitDto })
  @ApiResponse({
    status: 201,
    description: 'Debit accepted or rejected (check `accepted` field).',
    schema: {
      oneOf: [
        { $ref: getSchemaPath(WalletDebitAcceptedDto) },
        { $ref: getSchemaPath(WalletDebitRejectedDto) },
      ],
    },
  })
  @ApiValidationErrors()
  @ApiServerError()
  debit(@Body() body: DebitDto) {
    return this.cluster.debitWallet(body.amount);
  }

  @Post('admin/reconcile')
  @ApiOperation({
    summary: 'Heal partition and sync nodes',
    description: 'Clears the partition flag and copies node A state to node B (eventual consistency catch-up).',
  })
  @ApiResponse({ status: 201, type: ReconcileResponseDto })
  @ApiServerError()
  reconcile(): ReconcileResponseDto {
    return this.cluster.reconcile();
  }
}
