import { z } from 'zod';

export const OrderSideSchema = z.enum(['BUY', 'SELL']);
export type OrderSide = z.infer<typeof OrderSideSchema>;

export const OrderTypeSchema = z.enum(['LIMIT','MARKET']);
export type OrderType = z.infer<typeof OrderTypeSchema>;

export const TimeInForceSchema = z.enum(['GTC', 'DAY', 'IOC']);
export type TimeInForce = z.infer<typeof TimeInForceSchema>;

export const OrderStatusSchema = z.enum(['PENDING', 'OPEN', 'PARTIALLY_FILLED', 'FILLED', 'CANCELLED', 'EXPIRED']);
export type OrderStatus = z.infer<typeof OrderStatusSchema>;

export const InstrumentSchema = z.enum(['AAPL']);
export type Instrument = z.infer<typeof InstrumentSchema>;

export const OrderSchema = z.object({
  id: z.string(),
  userId: z.string(),
  side: OrderSideSchema,
  type: OrderTypeSchema,
  status: OrderStatusSchema,
  instrument: InstrumentSchema,
  price: z.number().positive().optional(),
  quantity: z.number().positive(),
  remainingQuantity: z.number().nonnegative(),
  timestamp: z.number(),
  timeInForce: TimeInForceSchema.default('GTC'),
  expiresAt: z.number().optional(),
}).refine(
  (data) => data.type === 'MARKET' || (data.type === 'LIMIT' && typeof data.price === 'number'),
  { message: 'LIMIT orders must have a price', path: ['price'] }
).refine(
  (data) => !data.price || Math.abs(data.price - Math.round(data.price * 100) / 100) < 1e-9,
  { message: 'Price must be in 0.01 increments', path: ['price'] }
);

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
  userId: true,
  side: true,
  type: true,
  instrument: true,
  price: true,
  quantity: true,
  timeInForce: true,
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

export const OrderCancelledPayloadSchema = z.object({
  orderId: z.string(),
  instrument: InstrumentSchema,
  side: OrderSideSchema,
});

export type OrderCancelledPayload = z.infer<typeof OrderCancelledPayloadSchema>;