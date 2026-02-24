import { Liquid } from 'liquidjs';
import { WalletAuthority } from './wallet-authority';
import { BlockProcessor } from './block-processor';

const engine = new Liquid({
  root: ['./views', './templates'], // where views & templates live
  extname: '.tpl'
});

export default {
  async fetch(request: Request, env: any) {
    const url = new URL(request.url);

    if (url.pathname === '/admin-panel') {
      // Example: fetch live data from your blockchain system
      const treasury = new WalletAuthority(env);
      const wallets = await env.D1.prepare('SELECT * FROM wallets').all();
      const intents = await env.D1.prepare('SELECT COUNT(*) as cnt FROM intents').first();
      const ledgerCount = await env.D1.prepare('SELECT COUNT(*) as cnt FROM public_ledger').first();

      // context for Liquid template
      const context = {
        page_title: 'Blockchain Admin Dashboard',
        wallets: wallets.results,
        walletCount: wallets.results.length,
        pendingIntents: intents.cnt || 0,
        ledgerCount: ledgerCount.cnt || 0,
      };

      // render dashboard view
      const html = await engine.renderFile('dashboard', context); // dashboard.tpl in views/
      return new Response(html, { headers: { 'Content-Type': 'text/html' } });
    }

    return new Response('Not found', { status: 404 });
  }
};