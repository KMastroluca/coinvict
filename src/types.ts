import { DateTime, Str } from "chanfana";
import type { Context } from "hono";
import { z } from "zod";

export type AppContext = Context<{ Bindings: Env }>;

export const Task = z.object({
	name: Str({ example: "lorem" }),
	slug: Str(),
	description: Str({ required: false }),
	completed: z.boolean().default(false),
	due_date: DateTime(),
});

export interface MintIntentPayload {
  wallet: string;           // pubkey to receive coin
  amount: number;           // number of coins
  reason: MintReasonType;   // one of the reason codes above
  liquidity_portion?: number; // optional: how much goes to liquidity pool
  nft_award?: string[];     // optional NFT(s) generated
  transaction_id: string;   // unique ID for audit/replay prevention
  timestamp: number;        // epoch time of intent creation
  metadata?: any;           // optional extra info (like app data mined)
}

export const MintReason = {
  OUTSIDE_DEPOSIT: "OutsideDepositIntoLiquidityPool",
  ENGAGEMENT_REWARD: "ApplicationEngagementReward",
  AD_REVENUE: "AdvertisingRevenueGenerated",
  DATA_MINED: "NewApplicationDataMined",
  USER_TASK: "UserTaskReward",
  USER_PURCHASE: "UserPurchaseAppFeatures",
  CRYPTO_STAKE: "UserCryptoStakeAward",
  CRYPTO_SWAP: "UserCryptoSwapAward"
} as const;

export type MintReasonType = typeof MintReason[keyof typeof MintReason];