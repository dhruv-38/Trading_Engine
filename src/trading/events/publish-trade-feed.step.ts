import { EventConfig, Handlers } from "motia";
import { Trade, TradeExecutedPayloadSchema } from "../services/types";
import { OrderBook } from "../services/order-book";
import { Order } from "../services/types";

export const config: EventConfig = {
    type: 'event',
    name: 'PublishTradeFeed',
    description: 'Publish trades to real-time stream',
    flows: ['order-management'],
    subscribes: ['trade.executed'],
    input: TradeExecutedPayloadSchema,
    emits: [],
};

export const handler: Handlers['PublishTradeFeed'] = async (input, { state, streams, logger }) => {
    try {
        const { tradeId, instrument } = input;
        const trade = await state.get<Trade>('trades', tradeId);

        if (!trade) {
            logger.warn('Trade not found for streaming', { tradeId });
            return;
        }

        await streams.tradeFeed.set(instrument, tradeId, trade);

        logger.info('Trade published to stream', { tradeId, instrument });
    } catch (error) {
        logger.error('Error publishing trade to stream', { error });
    }
};
