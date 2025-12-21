import { ApiRouteConfig, Handlers } from "motia";
import { Order } from "../services/types";
import { z } from "zod";
import { errorHandler } from "../middlewares/error-handler.middleware";

export const config: ApiRouteConfig = {
    type: 'api',
    name: 'CancelOrder',
    description: 'Cancel an existing order',
    flows: ['order-management'],
    method: 'DELETE',
    path: '/orders/:orderId',
    emits: ['order.cancelled'],
    responseSchema: {
        200: z.object({ orderId: z.string(), status: z.string() }),
        404: z.object({ error: z.string() }),
        400: z.object({ error: z.string() }),
        500: z.object({ error: z.string() }),
    },
    middleware:[errorHandler], 
};

export const handler: Handlers['CancelOrder'] = async (req, { emit, state, logger }) => {
    const { orderId } = req.pathParams;
    logger.info('Cancel order request', { orderId });

    try {
        const order = await state.get<Order>('orders', orderId);

        if (!order) {
            return {
                status: 404,
                body: { error: 'Order not found' }
            };
        }

        if (order.status === 'FILLED' || order.status === 'CANCELLED') {
            return {
                status: 400,
                body: { error: `Cannot cancel order with status ${order.status}` }
            };
        }

        await emit({ topic: 'order.cancelled', data: { orderId, instrument: order.instrument, side: order.side } });

        return {
            status: 200,
            body: { orderId, status: 'CANCELLING' }
        };
    } catch (error) {
        logger.error('Cancel order failed', { error, orderId });
        return {
            status: 500,
            body: { error: 'Failed to cancel order' }
        };
    }
};
