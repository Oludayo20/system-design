import { ClusterService } from './cluster.service';

describe('ClusterService', () => {
  it('accepts product view increments during a partition (AP)', () => {
    const cluster = new ClusterService();
    cluster.setPartitioned(true);

    const result = cluster.incrementProductViews();
    const nodes = cluster.getNodes();

    expect(result.accepted).toBe(true);
    expect(nodes[0].productViews).toBe(1251);
    expect(nodes[1].productViews).toBe(1250);
  });

  it('rejects wallet debits during a partition (CP)', () => {
    const cluster = new ClusterService();
    cluster.setPartitioned(true);

    const result = cluster.debitWallet(500);
    expect(result).toEqual({
      accepted: false,
      reason: 'Partition detected: wallet writes rejected to preserve consistency (CP)',
    });
  });
});
