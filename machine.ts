import { Machine, assign } from 'xstate'

import Pusher from 'pusher-js/react-native'

import { PUSHER_KEY } from './keys'

console.log({ PUSHER_KEY })

// Pusher.logToConsole = false

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
            })
        )
    } catch (err) {
        return new Promise((rej) => rej(err))
    }
}

export const pusherMachine = Machine(
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
                    CONNECT: 'initializing',
                },
            },
            connected: {
                id: 'connected',
            },
            initializing: {
                initial: 'creatingInstance',
                states: {
                    creatingInstance: {
                        invoke: {
                            id: 'createPusher',
                            src: createPusher,
                            onDone: {
                                target: 'subscribing',
                                actions: ['setPusher'],
                            },
                            onError: {
                                target: '#failed',
                                actions: ['setErrorMessage'],
                            },
                        },
                    },
                    subscribing: {
                        invoke: {
                            id: 'subscribingToChannel',
                            src: async (ctx) => {
                                const channel = ctx?.pusher?.subscribe('hal')

                                return new Promise((res, rej) => {
                                    channel.bind(
                                        'pusher:subscription_succeeded',
                                        () => res(channel)
                                    )
                                    channel.bind(
                                        'pusher:subscription_error',
                                        (err) => rej(err)
                                    )
                                })
                            },
                            onDone: {
                                target: '#connected',
                                actions: ['setChannel'],
                            },
                            onError: {
                                target: '#failed',
                                actions: ['setErrorMessage'],
                            },
                        },
                    },
                },
            },
            offline: {},
            failed: {
                id: 'failed',
            },
        },
    },
    {
        actions: {
            setPusher: assign({
                pusher: (ctx, event) => event.data,
            }),
            setChannel: assign({
                channel: (ctx, event) => event.data,
            }),
            setErrorMessage: assign({
                lastError: (ctx, event) => event.data,
            }),
        },
    }
)
