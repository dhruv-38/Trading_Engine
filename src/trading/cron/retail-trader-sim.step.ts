import { CronConfig, Handlers } from "motia";
import { Order } from "../services/types";
import { randomUUID } from "crypto";

export const config: CronConfig = {
    type: 'cron',
    name: 'RetailTraderSimulator',
    description: 'Simulates retail traders placing random orders every 15 seconds',
    flows: ['order-management'],
    cron: '*/15 * * * * *',
    emits: ['order.placed'],
};

const SIM_CONFIG = {
    INSTRUMENTS: ['AAPL'] as const,
    MIN_PRICE: 148.00,
    MAX_PRICE: 152.00,
    MIN_QUANTITY: 10,
    MAX_QUANTITY: 200,
    ORDER_TYPES: ['LIMIT', 'MARKET'] as const,
    SIDES: ['BUY', 'SELL'] as const,
    USER_POOL: ['trader1', 'trader2', 'trader3', 'trader4', 'trader5'],
};

function randomChoice<T>(array: readonly T[]): T {
    return array[Math.floor(Math.random() * array.length)];
}

function randomInt(min: number, max: number): number {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomPrice(min: number, max: number): number {
    const price = min + Math.random() * (max - min);
    return Math.round(price * 100) / 100;
}

export const handler: Handlers['RetailTraderSimulator'] = async ({ state, emit, logger }) => {
    try {
        const orderCount = randomInt(1, 3);

        for (let i = 0; i < orderCount; i++) {
            const instrument = randomChoice(SIM_CONFIG.INSTRUMENTS);
            const side = randomChoice(SIM_CONFIG.SIDES);
            const type = randomChoice(SIM_CONFIG.ORDER_TYPES);
            const userId = randomChoice(SIM_CONFIG.USER_POOL);
            const quantity = randomInt(SIM_CONFIG.MIN_QUANTITY, SIM_CONFIG.MAX_QUANTITY);

            const orderId = randomUUID();
            const order: Order = {
                id: orderId,
                userId,
                side,
                type,
                status: 'PENDING',
                instrument,
                quantity,
                remainingQuantity: quantity,
                timestamp: Date.now(),
                timeInForce: 'GTC',
            };

            if (type === 'LIMIT') {
                order.price = randomPrice(SIM_CONFIG.MIN_PRICE, SIM_CONFIG.MAX_PRICE);
            }

            await state.set('orders', orderId, order);
            await emit({ topic: 'order.placed', data: { orderId, instrument } });

            logger.info('Retail trader placed order', {
                userId,
                orderId,
                side,
                type,
                price: order.price,
                quantity,
            });
        }
    } catch (error) {
        logger.error('Retail trader simulator error', { error });
    }
};
