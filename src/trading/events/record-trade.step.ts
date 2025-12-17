import { EventConfig, Handlers } from "motia";
import { TradeExecutedPayloadSchema, Trade } from "../services/types";

export const config: EventConfig = {
    type: 'event',
    name: 'RecordTrade',
    description: 'Record executed trades for audit and analytics',
    flows: ['order-management'],
    subscribes: ['trade.executed'],
    emits: [],
    input: TradeExecutedPayloadSchema,
};

export const handler: Handlers['RecordTrade'] = async (input, { state, logger }) => {
    const { tradeId, buyOrderId, sellOrderId, instrument } = input;
    
    try {
        const trade = await state.get<Trade>('trades', tradeId);
        
        if (!trade) {
            logger.error('Trade not found for recording', { tradeId });
            return;
        }

        logger.info('Trade recorded', {
            tradeId,
            instrument,
            price: trade.price,
            quantity: trade.quantity,
            buyOrderId,
            sellOrderId,
        });
    } catch (error) {
        logger.error('Trade recording failed', { error, tradeId });
    }
};
