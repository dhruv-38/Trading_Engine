import { z } from 'zod';

export const OrderSideSchema = z.enum(['BUY', 'SELL']);
export type OrderSide = z.infer<typeof OrderSideSchema>;

export const OrderTypeSchema = z.enum(['LIMIT','MARKET']);
export type OrderType = z.infer<typeof OrderTypeSchema>;

export const OrderStatusSchema = z.enum(['PENDING', 'OPEN', 'PARTIALLY_FILLED', 'FILLED', 'CANCELLED']);
export type OrderStatus = z.infer<typeof OrderStatusSchema>;

export const InstrumentSchema = z.enum(['AAPL']);
export type Instrument = z.infer<typeof InstrumentSchema>;

export const OrderSchema = z.object({
  id: z.string(),
  side: OrderSideSchema,
  type: OrderTypeSchema,
  status: OrderStatusSchema,
  instrument: InstrumentSchema,
  price: z.number().positive().optional(),
  quantity: z.number().positive(),
  remainingQuantity: z.number().nonnegative(),
  timestamp: z.number(),
});

export type Order = z.infer<typeof OrderSchema>;

export const TradeSchema = z.object({
    id: z.string(),
    price: z.number().positive(),
    quantity : z.number().positive(),
    instrument : InstrumentSchema,
    sellOrderId: z.string(),
    buyOrderId: z.string(),
    timestamp : z.number(),
});

export type Trade = z.infer<typeof TradeSchema>;

export const PlaceOrderInputSchema = OrderSchema.pick({
  side: true,
  type: true,
  instrument: true,
  price: true,
  quantity: true,
});
export type PlaceOrderInput = z.infer<typeof PlaceOrderInputSchema>;

export const OrderPlacedPayloadSchema = z.object({
  orderId: z.string(),
  instrument: InstrumentSchema,
});

export type OrderPlacedPayload = z.infer<typeof OrderPlacedPayloadSchema>;

export const TradeExecutedPayloadSchema = z.object({
  tradeId: z.string(),
  buyOrderId: z.string(),
  sellOrderId: z.string(),
  instrument: InstrumentSchema,
});

export type TradeExecutedPayload = z.infer<typeof TradeExecutedPayloadSchema>;