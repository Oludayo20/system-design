import { Body, Controller, Get, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { ClusterService } from '../cluster/cluster.service';

class DebitDto {
  amount!: number;
}

@ApiTags('cap-demo')
@Controller()
export class CapController {
  constructor(private readonly cluster: ClusterService) {}

  @Get('nodes')
  nodes() {
    return {
      partitioned: this.cluster.isPartitioned(),
      nodes: this.cluster.getNodes(),
    };
  }

  @Post('admin/partition')
  partition(@Body() body: { enabled: boolean }) {
    this.cluster.setPartitioned(body.enabled);
    return { partitioned: this.cluster.isPartitioned() };
  }

  @Post('profile/view')
  viewProduct() {
    return this.cluster.incrementProductViews();
  }

  @Post('wallet/debit')
  debit(@Body() body: DebitDto) {
    return this.cluster.debitWallet(body.amount);
  }

  @Post('admin/reconcile')
  reconcile() {
    return this.cluster.reconcile();
  }
}
