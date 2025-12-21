import { EventConfig, Handlers } from "motia";
import { OrderCancelledPayloadSchema, Order } from "../services/types";
import { OrderBook } from "../services/order-book";

export const config: EventConfig = {
    type: 'event',
    name: 'PublishOrderbookFeedOnCancel',
    description: 'Publish orderbook snapshots after cancellations',
    flows: ['order-management'],
    subscribes: ['order.cancelled'],
    input: OrderCancelledPayloadSchema,
    emits: [],
};

export const handler: Handlers['PublishOrderbookFeedOnCancel'] = async (input, { state, streams, logger }) => {
    try {
        const { instrument } = input;
        await publishOrderbookSnapshot(instrument, state, streams, logger);
    } catch (error) {
        logger.error('Error publishing orderbook to stream', { error });
    }
};

async function publishOrderbookSnapshot(instrument: string, state: any, streams: any, logger: any) {
    const orderBook = new OrderBook(state);
    const buyOrders = await orderBook.getBuyOrders(instrument as any);
    const sellOrders = await orderBook.getSellOrders(instrument as any);

    const bids = aggregateByPrice(buyOrders).slice(0, 10);
    const asks = aggregateByPrice(sellOrders).slice(0, 10);

    const spread = asks[0] && bids[0] 
        ? (asks[0].price - bids[0].price).toFixed(2)
        : null;

    const snapshot = {
        instrument,
        timestamp: Date.now(),
        bids,
        asks,
        spread,
    };

    await streams.orderbookFeed.set(instrument, Date.now().toString(), snapshot);
}

function aggregateByPrice(orders: Order[]): Array<{ price: number; quantity: number; orders: number }> {
    const priceMap = new Map<number, { quantity: number; orders: number }>();

    for (const order of orders) {
        if (!order.price) continue;
        
        const existing = priceMap.get(order.price) || { quantity: 0, orders: 0 };
        existing.quantity += order.remainingQuantity;
        existing.orders += 1;
        priceMap.set(order.price, existing);
    }

    const levels = Array.from(priceMap.entries()).map(([price, data]) => ({
        price,
        quantity: data.quantity,
        orders: data.orders,
    }));

    return levels.sort((a, b) => b.price - a.price);
}
