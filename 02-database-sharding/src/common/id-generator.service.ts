import { Injectable } from '@nestjs/common';

/**
 * Generates globally unique, roughly time-ordered IDs safe to use as JS
 * numbers (i.e. they stay within Number.MAX_SAFE_INTEGER).
 *
 * Why not per-shard auto-increment? Because two shards would both hand out
 * id=1, id=2, ... and those IDs would collide the moment the system is
 * viewed as a whole (logs, analytics, the debug/distribution endpoint). The
 * fix used here - and in real sharded systems - is to mint the ID *before*
 * routing: generate a globally unique id first, hash that id to pick the
 * shard, then insert into that shard's table.
 *
 * This is a simplified Snowflake-style layout, sized to stay within a
 * 53-bit JS-safe integer (Postgres BIGINT itself supports the full 64 bits,
 * this is a deliberately conservative choice for this demo):
 *   33 bits - seconds since a custom epoch (~272 years of headroom)
 *    8 bits - worker id (0-255), set via WORKER_ID env var
 *   11 bits - per-second sequence (0-2047), for bursts within one second
 *
 * Not a distributed-consensus ID service - for production scale you'd run
 * a real Snowflake/Sonyflake-style cluster or dedicated ID service. Out of
 * scope here, same as resharding (see README).
 */
@Injectable()
export class IdGeneratorService {
  private static readonly EPOCH_SECONDS = 1_700_000_000; // fixed custom epoch
  private static readonly WORKER_BITS = 8;
  private static readonly SEQUENCE_BITS = 11;
  private static readonly MAX_SEQUENCE = (1 << IdGeneratorService.SEQUENCE_BITS) - 1;

  private readonly workerId: number;
  private sequence = 0;
  private lastSecond = -1;

  constructor() {
    this.workerId = Number(process.env.WORKER_ID ?? 1) & 0xff;
  }

  nextId(): number {
    let nowSeconds = Math.floor(Date.now() / 1000);

    if (nowSeconds === this.lastSecond) {
      this.sequence = (this.sequence + 1) & IdGeneratorService.MAX_SEQUENCE;
      if (this.sequence === 0) {
        // Sequence exhausted for this second - spin to the next one.
        while (nowSeconds <= this.lastSecond) {
          nowSeconds = Math.floor(Date.now() / 1000);
        }
      }
    } else {
      this.sequence = 0;
    }

    this.lastSecond = nowSeconds;

    const secondsPart = nowSeconds - IdGeneratorService.EPOCH_SECONDS;
    const workerShifted = this.workerId * 2 ** IdGeneratorService.SEQUENCE_BITS;
    const secondsShifted =
      secondsPart * 2 ** (IdGeneratorService.WORKER_BITS + IdGeneratorService.SEQUENCE_BITS);

    return secondsShifted + workerShifted + this.sequence;
  }
}
