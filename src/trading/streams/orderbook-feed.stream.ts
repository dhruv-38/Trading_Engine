import { StreamConfig } from "motia";
import { z } from "zod";

const OrderbookLevelSchema = z.object({
    price: z.number(),
    quantity: z.number(),
    orders: z.number(),
});

const OrderbookSnapshotSchema = z.object({
    instrument: z.string(),
    timestamp: z.number(),
    bids: z.array(OrderbookLevelSchema),
    asks: z.array(OrderbookLevelSchema),
    spread: z.string().nullable(),
});

export const config: StreamConfig = {
    name: 'orderbookFeed',
    schema: OrderbookSnapshotSchema,
    baseConfig: { storageType: 'default' },
};
