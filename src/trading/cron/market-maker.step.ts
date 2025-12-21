import { CronConfig, Handlers } from "motia";
import { Order, Position, Quote } from "../services/types";
import { randomUUID } from "crypto";

export const config: CronConfig = {
    type: 'cron',
    name: 'MarketMaker',
    description: 'Automated market maker - places bid/ask spreads every 5 seconds',
    flows: ['order-management'],
    cron: '*/5 * * * * *',
    emits: ['order.placed', 'quote.placed'],
};

const MM_CONFIG = {
    USER_ID: 'market-maker-bot',
    INSTRUMENTS: ['AAPL'] as const,
    BASE_SPREAD: 0.05,
    MIN_SPREAD: 0.02,
    MAX_SPREAD: 0.20,
    ORDER_SIZE: 100,
    MAX_POSITION: 1000,
    FAIR_VALUE: 150.00,
    VOLATILITY_FACTOR: 0.1,
};

export const handler: Handlers['MarketMaker'] = async ({ state, emit, logger }) => {
    logger.info('Market maker running...');

    try {
        for (const instrument of MM_CONFIG.INSTRUMENTS) {
            const positionKey = `${MM_CONFIG.USER_ID}:${instrument}`;
            let position = await state.get('positions', positionKey) as Position | null;
            
            if (!position) {
                position = {
                    userId: MM_CONFIG.USER_ID,
                    instrument,
                    quantity: 0,
                    averagePrice: MM_CONFIG.FAIR_VALUE,
                    realizedPnL: 0,
                    unrealizedPnL: 0,
                    lastUpdated: Date.now(),
                };
            }

            if (Math.abs(position.quantity) >= MM_CONFIG.MAX_POSITION) {
                logger.warn('Market maker position limit reached, skewing quotes', {
                    instrument,
                    position: position.quantity,
                });
            }

            const positionSkew = position.quantity / MM_CONFIG.MAX_POSITION;
            const spreadAdjustment = positionSkew * MM_CONFIG.VOLATILITY_FACTOR;
            
            const randomWalk = (Math.random() - 0.5) * 0.10;
            const midPrice = MM_CONFIG.FAIR_VALUE + randomWalk;
            
            let spread = MM_CONFIG.BASE_SPREAD + Math.abs(positionSkew) * 0.05;
            spread = Math.max(MM_CONFIG.MIN_SPREAD, Math.min(spread, MM_CONFIG.MAX_SPREAD));
            
            const bidPrice = Math.round((midPrice - spread / 2 - spreadAdjustment) * 100) / 100;
            const askPrice = Math.round((midPrice + spread / 2 - spreadAdjustment) * 100) / 100;

            const bidOrderId = randomUUID();
            const bidOrder: Order = {
                id: bidOrderId,
                userId: MM_CONFIG.USER_ID,
                side: 'BUY',
                type: 'LIMIT',
                status: 'PENDING',
                instrument,
                price: bidPrice,
                quantity: MM_CONFIG.ORDER_SIZE,
                remainingQuantity: MM_CONFIG.ORDER_SIZE,
                timestamp: Date.now(),
                timeInForce: 'GTC',
            };

            const askOrderId = randomUUID();
            const askOrder: Order = {
                id: askOrderId,
                userId: MM_CONFIG.USER_ID,
                side: 'SELL',
                type: 'LIMIT',
                status: 'PENDING',
                instrument,
                price: askPrice,
                quantity: MM_CONFIG.ORDER_SIZE,
                remainingQuantity: MM_CONFIG.ORDER_SIZE,
                timestamp: Date.now(),
                timeInForce: 'GTC',
            };

            await state.set('orders', bidOrderId, bidOrder);
            await state.set('orders', askOrderId, askOrder);

            const quote: Quote = {
                bidOrderId,
                askOrderId,
                instrument,
                createdAt: Date.now(),
                userId: MM_CONFIG.USER_ID,
            };
            await state.set('quotes', `${instrument}:${Date.now()}`, quote);

            await emit({ topic: 'order.placed', data: { orderId: bidOrderId, instrument } });
            await emit({ topic: 'order.placed', data: { orderId: askOrderId, instrument } });
            await emit({ topic: 'quote.placed', data: { bidOrderId, askOrderId, instrument } });

            logger.info('Market maker placed quotes', {
                instrument,
                bid: bidPrice,
                ask: askPrice,
                spread: (askPrice - bidPrice).toFixed(2),
                position: position.quantity,
                positionSkew: positionSkew.toFixed(2),
            });
        }
    } catch (error) {
        logger.error('Market maker error', { error });
    }
};
