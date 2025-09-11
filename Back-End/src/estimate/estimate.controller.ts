import { Body, Controller, Post } from '@nestjs/common';

@Controller('api/estimate')
export class EstimateController {
  @Post('delivery')
  delivery(@Body() body: { distanceKm: number }) {
    const tiers = [
      { maxKm: 3, fee: 40 },
      { maxKm: 6, fee: 60 },
      { maxKm: Infinity, fee: 100 },
    ];
    const d = body?.distanceKm ?? 0;
    let fee = tiers[tiers.length - 1].fee;
    for (const t of tiers) {
      if (d <= t.maxKm) { fee = t.fee; break; }
    }
    return { distanceKm: d, fee };
  }
}
