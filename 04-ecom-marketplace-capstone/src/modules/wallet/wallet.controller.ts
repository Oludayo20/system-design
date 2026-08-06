import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags, ApiUnauthorizedResponse } from '@nestjs/swagger';
import { WalletService } from './wallet.service';
import { WalletMeResponseDto } from './dto/wallet-response.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtPayload } from '../../common/jwt-payload.interface';

@ApiTags('wallet')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('wallet')
export class WalletController {
  constructor(private readonly walletService: WalletService) {}

  @Get('me')
  @ApiOperation({
    summary: 'Get wallet balance and recent ledger entries',
    description:
      'Wallet is colocated with User on the same shard (`hash(userId) % 3`). ' +
      'Order settlement debits arrive asynchronously via the Wallet worker.',
  })
  @ApiResponse({ status: 200, type: WalletMeResponseDto })
  @ApiUnauthorizedResponse({ description: 'Missing or invalid JWT.' })
  async me(@CurrentUser() user: JwtPayload) {
    const wallet = await this.walletService.getWallet(user.sub);
    const ledger = await this.walletService.getLedger(user.sub);
    return { wallet, ledger };
  }
}
