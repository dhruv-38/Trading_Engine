import { ApiRouteConfig, Handlers } from "motia";
import { Order, Trade } from "../services/types";
import { z } from "zod";

export const config: ApiRouteConfig = {
    type: 'api',
    name: 'ReplayOrderBook',
    description: 'Rebuild order book from event history for debugging and compliance',
    flows: ['order-management'],
    method: 'GET',
    path: '/orderbook/:instrument/replay',
    emits: [],
    responseSchema: {
        200: z.object({
            instrument: z.string(),
            buyOrders: z.array(z.any()),
            sellOrders: z.array(z.any()),
            totalTrades: z.number(),
            totalOrders: z.number(),
            replayedAt: z.number(),
        }),
        500: z.object({
            instrument: z.string(),
            buyOrders: z.array(z.any()),
            sellOrders: z.array(z.any()),
            totalTrades: z.number(),
            totalOrders: z.number(),
            replayedAt: z.number(),
        }),
    },
};

export const handler: Handlers['ReplayOrderBook'] = async (req, { state, logger }) => {
    const { instrument } = req.pathParams;
    logger.info('Replaying order book', { instrument });

    try {
        const allOrders = await state.getGroup<Order>('orders');
        const allTrades = await state.getGroup<Trade>('trades');

        const instrumentOrders = allOrders
            .filter(o => o.instrument === instrument)
            .sort((a, b) => a.timestamp - b.timestamp);

        const instrumentTrades = allTrades
            .filter(t => t.instrument === instrument)
            .sort((a, b) => a.timestamp - b.timestamp);

        const buyOrders: Order[] = [];
        const sellOrders: Order[] = [];

        for (const order of instrumentOrders) {
            if (order.type === 'LIMIT' && 
                (order.status === 'OPEN' || order.status === 'PARTIALLY_FILLED') &&
                order.remainingQuantity > 0) {
                
                if (order.side === 'BUY') {
                    buyOrders.push(order);
                } else {
                    sellOrders.push(order);
                }
            }
        }

        buyOrders.sort((a, b) => {
            if (a.price !== b.price) return b.price! - a.price!;
            return a.timestamp - b.timestamp;
        });

        sellOrders.sort((a, b) => {
            if (a.price !== b.price) return a.price! - b.price!;
            return a.timestamp - b.timestamp;
        });

        logger.info('Order book replayed', {
            instrument,
            buyOrders: buyOrders.length,
            sellOrders: sellOrders.length,
            totalTrades: instrumentTrades.length,
        });

        return {
            status: 200,
            body: {
                instrument,
                buyOrders: buyOrders.map(o => ({
                    id: o.id,
                    price: o.price,
                    quantity: o.remainingQuantity,
                    timestamp: o.timestamp,
                })),
                sellOrders: sellOrders.map(o => ({
                    id: o.id,
                    price: o.price,
                    quantity: o.remainingQuantity,
                    timestamp: o.timestamp,
                })),
                totalTrades: instrumentTrades.length,
                totalOrders: instrumentOrders.length,
                replayedAt: Date.now(),
            }
        };
    } catch (error) {
        logger.error('Replay failed', { error, instrument });
        return {
            status: 500,
            body: {
                instrument,
                buyOrders: [],
                sellOrders: [],
                totalTrades: 0,
                totalOrders: 0,
                replayedAt: Date.now(),
            }
        };
    }
};
