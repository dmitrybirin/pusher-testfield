import { Machine, assign } from 'xstate'

import Pusher from 'pusher-js/react-native'

import { PUSHER_KEY } from './keys'

Pusher.logToConsole = false

const createPusher = async () => {
    try {
        if (!PUSHER_KEY) {
            throw new Error('Oops, you need pusher key!')
        }

        const pusher = new Pusher(PUSHER_KEY, {
            cluster: 'eu',
        })

        return new Promise((res) =>
            pusher.connection.bind('connected', () => {
                res(pusher)
                pusher.connection.unbind_all()
            })
        )
    } catch (err) {
        return new Promise((rej) => rej(err))
    }

    // await new Promise(res => setTimeout(res, 2000))
}

export const pusheenMachine = Machine(
    {
        initial: 'idle',
        context: {
            pusher: null,
            channel: null,
            lastError: null,
        },
        states: {
            idle: {
                on: {
                    CONNECT: 'loading',
                },
            },
            connected: {},
            loading: {
                invoke: {
                    src: createPusher,
                    onDone: { target: 'connected', actions: ['setPusher', 'setChannel'] },
                    onError: { target: 'failed', actions: ['setErrorMessage'] },
                },
            },
            offline: {},
            failed: {},
        },
    },
    {
        actions: {
            setPusher: assign({
                pusher: (ctx, event) => event.data,
            }),
            setChannel: assign({
                channel: (ctx, event) => ctx.pusher?.subscribe('hal'),
            }),
            setErrorMessage: assign({
                lastError: (ctx, event) => event.data,
            }),
        },
    }
)
