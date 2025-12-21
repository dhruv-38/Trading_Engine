import { EventConfig, Handlers } from "motia";
import { QuotePlacedPayloadSchema } from "../services/types";

export const config: EventConfig = {
    type: 'event',
    name: 'CancelStaleQuotes',
    description: 'Cancel old market maker quotes to refresh liquidity',
    flows: ['order-management'],
    subscribes: ['quote.placed'],
    emits: ['order.cancelled'],
    input: QuotePlacedPayloadSchema,
};

const QUOTE_LIFETIME_MS = 10000;

export const handler: Handlers['CancelStaleQuotes'] = async (input, { state, emit, logger }) => {
    const { instrument } = input;

    try {
        logger.info('Quote cancellation triggered', { instrument });
        return;
    } catch (error) {
        logger.error('Error cancelling stale quotes', { error });
    }
};
